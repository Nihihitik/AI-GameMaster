from __future__ import annotations

import secrets
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.dev_test_lobby_link import DevTestLobbyLink
from models.game_event import GameEvent
from models.player import Player
from models.session import Session
from models.user import User
from schemas.dev import DevLobbyInfo, DevLobbyPlayerLink
from schemas.session import PlayerInList, SessionDetailResponse
from services.auth_service import hash_password


DEV_TEST_LOBBY_FLAG = "dev_test_lobby"
DEFAULT_TEST_LOBBY_PLAYER_COUNT = 5
MAX_TEST_LOBBY_PLAYER_COUNT = 20


def is_dev_test_lobby(session: Session | None) -> bool:
    if session is None:
        return False
    return bool((session.settings or {}).get(DEV_TEST_LOBBY_FLAG))


def make_test_player_slug(slot_number: int) -> str:
    return f"player{slot_number}"


def make_test_player_name(slot_number: int) -> str:
    return f"Player {slot_number}"


def build_test_player_url(session_code: str, player_slug: str, bootstrap_key: str) -> str:
    return f"/sessions/{session_code}/{player_slug}?devKey={bootstrap_key}"


def apply_dev_test_lobby_flag(settings: dict) -> dict:
    return {**settings, DEV_TEST_LOBBY_FLAG: True}


async def list_dev_links(db: AsyncSession, session_id: uuid.UUID) -> list[DevTestLobbyLink]:
    return list(
        (
            await db.scalars(
                select(DevTestLobbyLink)
                .where(DevTestLobbyLink.session_id == session_id)
                .order_by(DevTestLobbyLink.slot_number)
            )
        ).all()
    )


async def build_dev_lobby_info(
    db: AsyncSession,
    session: Session,
    current_user_id: uuid.UUID,
) -> DevLobbyInfo | None:
    if not is_dev_test_lobby(session):
        return None

    if session.host_user_id != current_user_id:
        return DevLobbyInfo(is_test_lobby=True, player_links=None)

    links = await list_dev_links(db, session.id)
    by_user_id = {link.user_id: link for link in links}
    player_links: list[DevLobbyPlayerLink] = []
    for player in sorted(session.players, key=lambda item: item.join_order):
        dev_link = by_user_id.get(player.user_id)
        if dev_link is None:
            continue
        url = (
            f"/sessions/{session.code}"
            if dev_link.slot_number == 1
            else build_test_player_url(session.code, dev_link.player_slug, dev_link.bootstrap_key)
        )
        player_links.append(
            DevLobbyPlayerLink(
                slot_number=dev_link.slot_number,
                player_slug=dev_link.player_slug,
                player_name=player.name,
                url=url,
            )
        )

    return DevLobbyInfo(is_test_lobby=True, player_links=player_links)


async def build_session_detail_response(
    db: AsyncSession,
    session: Session,
    current_user_id: uuid.UUID,
) -> SessionDetailResponse:
    players = [
        PlayerInList(
            id=str(p.id),
            name=p.name,
            join_order=p.join_order,
            is_host=(p.user_id == session.host_user_id),
            is_me=(p.user_id == current_user_id),
        )
        for p in sorted(session.players, key=lambda x: x.join_order)
    ]
    return SessionDetailResponse(
        id=str(session.id),
        code=session.code,
        host_user_id=str(session.host_user_id),
        player_count=session.player_count,
        status=session.status,
        settings=session.settings,
        players=players,
        created_at=session.created_at.isoformat() if session.created_at else "",
        dev_lobby=await build_dev_lobby_info(db, session, current_user_id),
    )


async def create_synthetic_test_player(
    db: AsyncSession,
    session: Session,
    slot_number: int,
    *,
    created_by_host_id: uuid.UUID,
) -> tuple[User, Player, DevTestLobbyLink]:
    suffix = uuid.uuid4().hex[:12]
    slug = make_test_player_slug(slot_number)
    name = make_test_player_name(slot_number)
    user = User(
        id=uuid.uuid4(),
        email=f"dev.{session.code.lower()}.{slug}.{suffix}@local.test",
        display_name=name,
        password_hash=hash_password(f"dev-{suffix}-password"),
    )
    player = Player(
        id=uuid.uuid4(),
        session_id=session.id,
        user_id=user.id,
        name=name,
        join_order=slot_number,
        status="alive",
        role_id=None,
    )
    link = DevTestLobbyLink(
        id=uuid.uuid4(),
        session_id=session.id,
        user_id=user.id,
        slot_number=slot_number,
        player_slug=slug,
        bootstrap_key=secrets.token_urlsafe(24),
    )
    db.add(user)
    # User/link are separate models without ORM relationship metadata between them,
    # so flush here to guarantee the FK target exists before dev_test_lobby_links insert.
    await db.flush()
    db.add(player)
    db.add(link)
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=None,
            event_type="player_joined",
            payload={
                "player_id": str(player.id),
                "name": player.name,
                "join_order": player.join_order,
                "created_by_host_id": str(created_by_host_id),
            },
        )
    )
    return user, player, link
