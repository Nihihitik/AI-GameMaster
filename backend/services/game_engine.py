"""Игровой движок (server-side источник истины).

Отвечает за:
- переходы фаз (role_reveal -> night -> day discussion -> day voting -> night ...)
- таймеры (через `services/timer_service.py`)
- запись событий в `game_events` для восстановления состояния после реконнекта/рестарта
- WS push-события участникам с `announcement.trigger` для локальной озвучки на клиенте
"""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone

from sqlalchemy import String, cast, delete, exists, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.exceptions import GameError
from models.game_event import GameEvent
from models.game_phase import GamePhase
from models.night_action import NightAction
from models.day_vote import DayVote
from models.player import Player
from models.role import Role
from models.session import Session
from services.timer_service import timer_service
from services.runtime_state import runtime_state
from services.ws_manager import ws_manager


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _announcement(trigger: str) -> dict:
    """Триггер для локальной озвучки на клиенте.

    Клиент по trigger выбирает одну из заранее заготовленных фраз.
    """
    return {"trigger": trigger}


async def _persist_phase_changed(
    db: AsyncSession,
    session_id: uuid.UUID,
    phase_id: uuid.UUID,
    payload: dict,
) -> None:
    """Персистим phase_changed так, чтобы можно было восстановить подфазу/таймер/ночной ход."""
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session_id,
            phase_id=phase_id,
            event_type="phase_changed",
            payload=payload,
        )
    )
    await db.commit()

async def get_current_phase(db: AsyncSession, session_id: uuid.UUID) -> GamePhase | None:
    return await db.scalar(
        select(GamePhase)
        .where(GamePhase.session_id == session_id, GamePhase.ended_at.is_(None))
        .order_by(GamePhase.started_at.desc())
        .limit(1)
    )


async def check_win_condition(db: AsyncSession, session_id: uuid.UUID) -> str | None:
    alive = (await db.scalars(select(Player).where(Player.session_id == session_id, Player.status == "alive"))).all()
    if not alive:
        return None
    role_ids = {p.role_id for p in alive if p.role_id is not None}
    if not role_ids:
        return None
    roles = (await db.scalars(select(Role).where(Role.id.in_(role_ids)))).all()
    role_by_id = {r.id: r for r in roles}
    alive_mafia = sum(1 for p in alive if p.role_id and role_by_id[p.role_id].team == "mafia")
    alive_city = sum(1 for p in alive if p.role_id and role_by_id[p.role_id].team == "city")
    if alive_mafia == 0:
        return "city"
    if alive_mafia >= alive_city:
        return "mafia"
    return None


async def start_game(db: AsyncSession, session: Session) -> None:
    if session.status != "waiting":
        raise GameError(409, "game_already_started", "Игра уже началась")

    players = (await db.scalars(select(Player).where(Player.session_id == session.id))).all()
    role_cfg = (session.settings or {}).get("role_config") or {}
    mafia = int(role_cfg.get("mafia", 0))
    sheriff = int(role_cfg.get("sheriff", 0))
    doctor = int(role_cfg.get("doctor", 0))
    civilian = int(role_cfg.get("civilian", 0))

    if len(players) < mafia + sheriff + doctor + civilian:
        raise GameError(400, "insufficient_players", "Недостаточно игроков для выбранной конфигурации")

    if mafia >= (len(players) - mafia):
        raise GameError(400, "invalid_role_config", "Мафия должна быть строго меньше города")

    roles = (await db.scalars(select(Role).where(Role.slug.in_(["mafia", "sheriff", "doctor", "civilian"])))).all()
    role_by_slug = {r.slug: r for r in roles}
    missing = [s for s in ["mafia", "sheriff", "doctor", "civilian"] if s not in role_by_slug]
    if missing:
        raise GameError(500, "internal_error", f"Не хватает ролей в БД: {', '.join(missing)}")

    role_pool = (
        ["mafia"] * mafia
        + ["sheriff"] * sheriff
        + ["doctor"] * doctor
        + ["civilian"] * (len(players) - mafia - sheriff - doctor)
    )
    random.shuffle(role_pool)
    for p, slug in zip(players, role_pool, strict=False):
        p.role_id = role_by_slug[slug].id

    phase = GamePhase(
        id=uuid.uuid4(),
        session_id=session.id,
        phase_type="role_reveal",
        phase_number=0,
        started_at=_now(),
        ended_at=None,
    )
    db.add(phase)
    session.status = "active"

    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=phase.id,
            event_type="game_started",
            payload={"phase": {"type": "role_reveal", "number": 0}},
        )
    )
    await db.commit()

    timer_seconds = int((session.settings or {}).get("role_reveal_timer_seconds") or 15)
    await ws_manager.send_to_session(
        session.id,
        {
            "type": "game_started",
            "payload": {
                "phase": {"type": "role_reveal", "number": 0},
                "timer_seconds": timer_seconds,
                "started_at": phase.started_at.isoformat(),
                "announcement": _announcement("game_started"),
            },
        },
    )

    # Персонально роль (эфемерное)
    for p in players:
        r = role_by_slug[[s for s in role_by_slug if role_by_slug[s].id == p.role_id][0]]
        await ws_manager.send_to_user(
            session.id,
            p.user_id,
            {"type": "role_assigned", "payload": {"role": {"name": r.name, "team": r.team, "abilities": r.abilities}}},
        )

    async def _on_role_reveal_timeout():
        await transition_to_night(session.id, 1)

    await timer_service.start_timer(session.id, "role_reveal", timer_seconds, _on_role_reveal_timeout)


async def acknowledge_role(db: AsyncSession, session: Session, player: Player) -> dict:
    phase = await get_current_phase(db, session.id)
    if not phase or phase.phase_type != "role_reveal":
        raise GameError(403, "wrong_phase", "Действие недоступно в текущей фазе")
    if player.status != "alive":
        raise GameError(403, "player_dead", "Выбывшие игроки не могут совершать действия")

    exists = await db.scalar(
        select(GameEvent.id).where(
            GameEvent.session_id == session.id,
            GameEvent.phase_id == phase.id,
            GameEvent.event_type == "role_acknowledged",
            GameEvent.payload["player_id"].astext == str(player.id),
        )
    )
    if exists:
        raise GameError(409, "action_already_submitted", "Вы уже сделали выбор в этой фазе")

    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=phase.id,
            event_type="role_acknowledged",
            payload={"player_id": str(player.id)},
        )
    )
    await db.commit()

    alive_total = await db.scalar(
        select(func.count(Player.id)).where(Player.session_id == session.id, Player.status == "alive")
    )
    acked = await db.scalar(
        select(func.count(GameEvent.id)).where(
            GameEvent.session_id == session.id,
            GameEvent.phase_id == phase.id,
            GameEvent.event_type == "role_acknowledged",
        )
    )
    alive_total = int(alive_total or 0)
    acked = int(acked or 0)
    ack_subq = exists(
        select(1).where(
            GameEvent.session_id == session.id,
            GameEvent.phase_id == phase.id,
            GameEvent.event_type == "role_acknowledged",
            GameEvent.payload["player_id"].astext == cast(Player.id, String),
        )
    )
    pending_alive = await db.scalar(
        select(func.count(Player.id)).where(
            Player.session_id == session.id,
            Player.status == "alive",
            ~ack_subq,
        )
    )
    pending_alive = int(pending_alive or 0)
    await ws_manager.send_to_session(
        session.id,
        {
            "type": "role_acknowledged",
            "payload": {"player_id": str(player.id), "players_acknowledged": acked, "players_total": alive_total},
        },
    )
    if alive_total and pending_alive == 0:
        await ws_manager.send_to_session(session.id, {"type": "all_acknowledged", "payload": {}})
        # иначе сработает таймер role_reveal и второй раз вызовет transition_to_night → duplicate phase
        await timer_service.cancel_timer(session.id, "role_reveal")
        await transition_to_night(session.id, 1)

    return {"acknowledged": True, "players_acknowledged": acked, "players_total": total}


async def transition_to_night(session_id: uuid.UUID, phase_number: int):
    from core.database import async_session_factory

    async with async_session_factory() as db:
        session = await db.get(Session, session_id)
        if not session or session.status != "active":
            return
        dup_night = await db.scalar(
            select(GamePhase.id).where(
                GamePhase.session_id == session_id,
                GamePhase.phase_number == phase_number,
                GamePhase.phase_type == "night",
            )
        )
        if dup_night is not None:
            return
        current = await get_current_phase(db, session_id)
        if current and current.ended_at is None:
            current.ended_at = _now()

        phase = GamePhase(
            id=uuid.uuid4(),
            session_id=session_id,
            phase_type="night",
            phase_number=phase_number,
            started_at=_now(),
            ended_at=None,
        )
        db.add(phase)
        try:
            # Персистим смену фазы ночи (базовый вход в ночь).
            await _persist_phase_changed(
                db,
                session_id,
                phase.id,
                {
                    "phase": {"type": "night", "number": phase_number},
                    "sub_phase": None,
                    "night_turn": "mafia",
                    "timer_seconds": int((session.settings or {}).get("night_action_timer_seconds") or 30),
                    "timer_started_at": _now().isoformat(),
                    "announcement": _announcement("night_start"),
                },
            )
        except IntegrityError:
            await db.rollback()
            return

        await ws_manager.send_to_session(
            session_id,
            {
                "type": "phase_changed",
                "payload": {
                    "phase": {"type": "night", "number": phase_number},
                    "sub_phase": None,
                    "timer_seconds": None,
                    "timer_started_at": None,
                    "announcement": _announcement("night_start"),
                },
            },
        )

        # Запускаем последовательность ходов ночи (MVP: mafia -> doctor -> sheriff)
        paused = await execute_night_sequence(db, session, phase)
        if paused == "paused":
            return


async def execute_night_sequence(
    db: AsyncSession,
    session: Session,
    phase: GamePhase,
    resume_from: tuple[str, int] | None = None,
) -> str | None:
    """Ночная очередь. Возвращает \"paused\", если игра поставлена на паузу (resolve_night не вызывается)."""
    settings = session.settings or {}
    turn_seconds = int(settings.get("night_action_timer_seconds") or 30)
    rt = runtime_state.get(session.id)

    players = (
        await db.scalars(
            select(Player)
            .options(selectinload(Player.role))
            .where(Player.session_id == session.id)
        )
    ).all()
    alive = [p for p in players if p.status == "alive"]
    # подтянуть роли одним запросом
    role_ids = {p.role_id for p in alive if p.role_id}
    roles = (await db.scalars(select(Role).where(Role.id.in_(role_ids)))).all() if role_ids else []
    role_by_id = {r.id: r for r in roles}

    def role_slug(p: Player) -> str | None:
        if not p.role_id:
            return None
        r = role_by_id.get(p.role_id)
        return r.slug if r else None

    async def _run_turn(turn_slug: str, seconds_for_turn: int) -> str | None:
        """Возвращает \"paused\" | \"aborted\" или None если ход завершён штатно."""
        rt.night_turn = turn_slug
        rt.timer_name = f"night_{turn_slug}"
        rt.timer_seconds = seconds_for_turn
        rt.timer_started_at = _now()
        rt.night_action_event.clear()

        # Персистим текущий ночной ход (чтобы можно было восстановиться после рестарта).
        await _persist_phase_changed(
            db,
            session.id,
            phase.id,
            {
                "phase": {"type": "night", "number": phase.phase_number},
                "sub_phase": None,
                "night_turn": turn_slug,
                "timer_seconds": seconds_for_turn,
                "timer_started_at": rt.timer_started_at.isoformat(),
                "announcement": _announcement(f"{turn_slug}_turn"),
            },
        )

        # если действие уже сделано в БД — пропускаем ход (идемпотентность / resume mid-night)
        if turn_slug == "mafia":
            already_kill = await db.scalar(
                select(NightAction.id).where(
                    NightAction.phase_id == phase.id,
                    NightAction.action_type == "kill",
                )
            )
            if already_kill is not None:
                return None
            actors = [p for p in alive if role_slug(p) == "mafia"]
            available_targets = [
                {"player_id": str(p.id), "name": p.name}
                for p in alive
                if role_slug(p) != "mafia"
            ]
            if not actors:
                return None
            for a in actors:
                await ws_manager.send_to_user(
                    session.id,
                    a.user_id,
                    {
                        "type": "action_required",
                        "payload": {
                            "action_type": "kill",
                            "available_targets": available_targets,
                            "timer_seconds": seconds_for_turn,
                            "timer_started_at": rt.timer_started_at.isoformat(),
                            "announcement": _announcement("mafia_turn"),
                        },
                    },
                )
        else:
            actors = [p for p in alive if role_slug(p) == turn_slug]
            if not actors:
                return None
            actor = actors[0]
            already = await db.scalar(
                select(NightAction.id).where(
                    NightAction.phase_id == phase.id,
                    NightAction.actor_player_id == actor.id,
                )
            )
            if already is not None:
                return None
            if turn_slug == "doctor":
                available_targets = [{"player_id": str(p.id), "name": p.name} for p in alive]
                action_type = "heal"
            else:
                available_targets = [
                    {"player_id": str(p.id), "name": p.name} for p in alive if p.id != actor.id
                ]
                action_type = "check"
            await ws_manager.send_to_user(
                session.id,
                actor.user_id,
                {
                    "type": "action_required",
                    "payload": {
                        "action_type": action_type,
                        "available_targets": available_targets,
                        "timer_seconds": seconds_for_turn,
                        "timer_started_at": rt.timer_started_at.isoformat(),
                        "announcement": _announcement(f"{turn_slug}_turn"),
                    },
                },
            )

        async def _timeout():
            await ws_manager.send_to_session(
                session.id, {"type": "action_timeout", "payload": {"action_type": turn_slug}}
            )
            rt.night_action_event.set()

        await timer_service.start_timer(session.id, rt.timer_name, seconds_for_turn, _timeout)
        await rt.night_action_event.wait()
        await timer_service.cancel_timer(session.id, rt.timer_name)
        rt.night_action_event.clear()
        if rt.night_sequence_abort:
            return "aborted"
        if rt.game_paused:
            return "paused"
        return None

    order = ["mafia", "doctor", "sheriff"]
    start_idx = 0
    first_seconds: int | None = None
    if resume_from:
        try:
            start_idx = order.index(resume_from[0])
        except ValueError:
            start_idx = 0
        first_seconds = max(1, int(resume_from[1]))

    for i, turn_slug in enumerate(order[start_idx:], start=start_idx):
        if rt.night_sequence_abort:
            break
        if rt.game_paused:
            return "paused"
        sec = first_seconds if (first_seconds is not None and i == start_idx) else turn_seconds
        res = await _run_turn(turn_slug, sec)
        if res == "paused":
            return "paused"
        if res == "aborted":
            break

    if rt.night_sequence_abort:
        rt.night_sequence_abort = False

    rt.night_turn = None
    rt.timer_name = None
    rt.timer_seconds = None
    rt.timer_started_at = None

    await resolve_night(db, session, phase)
    return None


def request_night_abort(session_id: uuid.UUID) -> None:
    """Кик во время ночи: прервать ожидание хода и дойти до resolve_night."""
    rt = runtime_state.get(session_id)
    rt.night_sequence_abort = True
    rt.night_action_event.set()


async def resolve_night(db: AsyncSession, session: Session, phase: GamePhase) -> None:
    # mafia kill
    mafia_action = await db.scalar(
        select(NightAction).where(NightAction.phase_id == phase.id, NightAction.action_type == "kill")
    )
    doctor_action = await db.scalar(
        select(NightAction).where(NightAction.phase_id == phase.id, NightAction.action_type == "heal")
    )

    died_player: Player | None = None
    if mafia_action:
        target = await db.get(Player, mafia_action.target_player_id)
        if target and target.status == "alive":
            if doctor_action and doctor_action.target_player_id == mafia_action.target_player_id:
                mafia_action.was_blocked = True
            else:
                target.status = "dead"
                died_player = target

    payload = (
        {"died": [{"player_id": str(died_player.id), "name": died_player.name}]} if died_player else {"died": None}
    )
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=phase.id,
            event_type="night_result",
            payload=payload,
        )
    )
    if died_player:
        db.add(
            GameEvent(
                id=uuid.uuid4(),
                session_id=session.id,
                phase_id=phase.id,
                event_type="player_eliminated",
                payload={"player_id": str(died_player.id), "name": died_player.name, "cause": "night"},
            )
        )
    await db.commit()

    await ws_manager.send_to_session(
        session.id,
        {"type": "night_result", "payload": {**payload, "announcement": _announcement("night_result")}},
    )
    if died_player:
        await ws_manager.send_to_session(
            session.id,
            {
                "type": "player_eliminated",
                "payload": {"player_id": str(died_player.id), "name": died_player.name, "cause": "night"},
            },
        )

    winner = await check_win_condition(db, session.id)
    if winner:
        await finish_game(db, session, winner)
        return

    # переход в день
    await transition_to_day(session.id, phase.phase_number)


async def transition_to_day(session_id: uuid.UUID, phase_number: int):
    from core.database import async_session_factory

    async with async_session_factory() as db:
        session = await db.get(Session, session_id)
        if not session or session.status != "active":
            return
        dup_day = await db.scalar(
            select(GamePhase.id).where(
                GamePhase.session_id == session_id,
                GamePhase.phase_number == phase_number,
                GamePhase.phase_type == "day",
            )
        )
        if dup_day is not None:
            return
        current = await get_current_phase(db, session_id)
        if current and current.ended_at is None:
            current.ended_at = _now()

        phase = GamePhase(
            id=uuid.uuid4(),
            session_id=session_id,
            phase_type="day",
            phase_number=phase_number,
            started_at=_now(),
            ended_at=None,
        )
        db.add(phase)
        try:
            await _persist_phase_changed(
                db,
                session_id,
                phase.id,
                {
                    "phase": {"type": "day", "number": phase_number},
                    "sub_phase": "discussion",
                    "night_turn": None,
                    "timer_seconds": int((session.settings or {}).get("discussion_timer_seconds") or 120),
                    "timer_started_at": _now().isoformat(),
                    "announcement": _announcement("day_discussion_start"),
                },
            )
        except IntegrityError:
            await db.rollback()
            return

        settings = session.settings or {}
        discussion_seconds = int(settings.get("discussion_timer_seconds") or 120)
        rt = runtime_state.get(session_id)
        rt.day_sub_phase = "discussion"
        rt.timer_name = "discussion"
        rt.timer_seconds = discussion_seconds
        rt.timer_started_at = _now()

        await ws_manager.send_to_session(
            session_id,
            {
                "type": "phase_changed",
                "payload": {
                    "phase": {"type": "day", "number": phase_number},
                    "sub_phase": "discussion",
                    "timer_seconds": discussion_seconds,
                    "timer_started_at": rt.timer_started_at.isoformat(),
                    "announcement": _announcement("day_discussion_start"),
                },
            },
        )

        async def _to_voting():
            await transition_to_voting(session_id)

        await timer_service.start_timer(session_id, "discussion", discussion_seconds, _to_voting)


async def transition_to_voting(session_id: uuid.UUID):
    from core.database import async_session_factory

    async with async_session_factory() as db:
        session = await db.get(Session, session_id)
        if not session or session.status != "active":
            return
        phase = await get_current_phase(db, session_id)
        if not phase or phase.phase_type != "day":
            return

        settings = session.settings or {}
        voting_seconds = int(settings.get("voting_timer_seconds") or 60)
        rt = runtime_state.get(session_id)
        rt.day_sub_phase = "voting"
        rt.timer_name = "voting"
        rt.timer_seconds = voting_seconds
        rt.timer_started_at = _now()

        # Персистим смену подфазы -> voting
        await _persist_phase_changed(
            db,
            session_id,
            phase.id,
            {
                "phase": {"type": "day", "number": phase.phase_number},
                "sub_phase": "voting",
                "night_turn": None,
                "timer_seconds": voting_seconds,
                "timer_started_at": rt.timer_started_at.isoformat(),
                "announcement": _announcement("day_voting_start"),
            },
        )

        await ws_manager.send_to_session(
            session_id,
            {
                "type": "phase_changed",
                "payload": {
                    "phase": {"type": "day", "number": phase.phase_number},
                    "sub_phase": "voting",
                    "timer_seconds": voting_seconds,
                    "timer_started_at": rt.timer_started_at.isoformat(),
                    "announcement": _announcement("day_voting_start"),
                },
            },
        )

        async def _resolve():
            await resolve_votes(session_id)

        await timer_service.start_timer(session_id, "voting", voting_seconds, _resolve)


async def resolve_votes(session_id: uuid.UUID):
    from core.database import async_session_factory

    async with async_session_factory() as db:
        session = await db.get(Session, session_id)
        if not session or session.status != "active":
            return
        phase = await get_current_phase(db, session_id)
        if not phase or phase.phase_type != "day":
            return

        # собрать голоса
        votes = (await db.scalars(select(DayVote).where(DayVote.phase_id == phase.id))).all()
        # подсчёт
        counts: dict[uuid.UUID, int] = {}
        for v in votes:
            if v.target_player_id is None:
                continue
            counts[v.target_player_id] = counts.get(v.target_player_id, 0) + 1

        eliminated_id: uuid.UUID | None = None
        if counts:
            sorted_items = sorted(counts.items(), key=lambda x: x[1], reverse=True)
            if len(sorted_items) == 1 or sorted_items[0][1] > sorted_items[1][1]:
                eliminated_id = sorted_items[0][0]

        eliminated_player = await db.get(Player, eliminated_id) if eliminated_id else None
        if eliminated_player and eliminated_player.status == "alive":
            eliminated_player.status = "dead"

        all_votes = [{"voter_player_id": str(v.voter_player_id), "target_player_id": str(v.target_player_id) if v.target_player_id else None} for v in votes]
        db.add(
            GameEvent(
                id=uuid.uuid4(),
                session_id=session_id,
                phase_id=phase.id,
                event_type="vote_result",
                payload={"eliminated": str(eliminated_id) if eliminated_id else None, "votes": all_votes},
            )
        )
        if eliminated_player and eliminated_player.status == "dead":
            db.add(
                GameEvent(
                    id=uuid.uuid4(),
                    session_id=session_id,
                    phase_id=phase.id,
                    event_type="player_eliminated",
                    payload={"player_id": str(eliminated_player.id), "name": eliminated_player.name, "cause": "vote"},
                )
            )
        await db.commit()

        await ws_manager.send_to_session(
            session_id,
            {
                "type": "vote_result",
                "payload": {
                    "eliminated": (
                        {"player_id": str(eliminated_player.id), "name": eliminated_player.name}
                        if eliminated_player and eliminated_id
                        else None
                    ),
                    "votes": all_votes,
                    "announcement": _announcement("vote_result"),
                },
            },
        )
        if eliminated_player and eliminated_id:
            await ws_manager.send_to_session(
                session_id,
                {
                    "type": "player_eliminated",
                    "payload": {"player_id": str(eliminated_player.id), "name": eliminated_player.name, "cause": "vote"},
                },
            )

        winner = await check_win_condition(db, session_id)
        if winner:
            await finish_game(db, session, winner)
            return

        # закончить день -> ночь+1
        phase.ended_at = _now()
        await db.commit()
        await transition_to_night(session_id, phase.phase_number + 1)


async def apply_host_kick(db: AsyncSession, session: Session, kicked: Player) -> None:
    """Кик хостом во время активной игры: игрок выбывает, ночь может прерваться и перейти к resolve."""
    kicked.status = "dead"
    phase = await get_current_phase(db, session.id)
    rt = runtime_state.get(session.id)

    if phase and phase.phase_type == "day" and rt.day_sub_phase == "voting":
        await db.execute(delete(DayVote).where(DayVote.phase_id == phase.id, DayVote.voter_player_id == kicked.id))

    if phase and phase.phase_type == "night":
        if rt.mafia_choice_by == kicked.id:
            rt.mafia_choice_target = None
            rt.mafia_choice_by = None

    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=phase.id if phase else None,
            event_type="player_kicked",
            payload={"player_id": str(kicked.id), "name": kicked.name},
        )
    )
    await db.commit()

    if phase and phase.phase_type == "night":
        request_night_abort(session.id)
        await timer_service.cancel_all(session.id)

    winner = await check_win_condition(db, session.id)
    if winner:
        s2 = await db.get(Session, session.id)
        if s2:
            await finish_game(db, s2, winner)
        return

    if phase and phase.phase_type == "role_reveal":
        ack_subq = exists(
            select(1).where(
                GameEvent.session_id == session.id,
                GameEvent.phase_id == phase.id,
                GameEvent.event_type == "role_acknowledged",
                GameEvent.payload["player_id"].astext == cast(Player.id, String),
            )
        )
        pending_alive = await db.scalar(
            select(func.count(Player.id)).where(
                Player.session_id == session.id,
                Player.status == "alive",
                ~ack_subq,
            )
        )
        alive_cnt = await db.scalar(
            select(func.count(Player.id)).where(Player.session_id == session.id, Player.status == "alive")
        )
        if int(alive_cnt or 0) > 0 and int(pending_alive or 0) == 0:
            await timer_service.cancel_timer(session.id, "role_reveal")
            await transition_to_night(session.id, 1)
        return

    if phase and phase.phase_type == "day" and rt.day_sub_phase == "voting":
        votes_cast = await db.scalar(select(func.count(DayVote.id)).where(DayVote.phase_id == phase.id))
        alive_cnt = await db.scalar(
            select(func.count(Player.id)).where(Player.session_id == session.id, Player.status == "alive")
        )
        if int(votes_cast or 0) >= int(alive_cnt or 0) and int(alive_cnt or 0) > 0:
            await timer_service.cancel_timer(session.id, "voting")
            await resolve_votes(session.id)


async def finish_game(db: AsyncSession, session: Session, winner: str) -> None:
    session.status = "finished"
    session.ended_at = _now()
    cur = dict(session.settings or {})
    cur.pop("game_pause", None)
    session.settings = cur
    phase = await get_current_phase(db, session.id)
    if phase and phase.ended_at is None:
        phase.ended_at = _now()

    players = (
        await db.scalars(select(Player).options(selectinload(Player.role)).where(Player.session_id == session.id))
    ).all()
    role_ids = {p.role_id for p in players if p.role_id}
    roles = (await db.scalars(select(Role).where(Role.id.in_(role_ids)))).all() if role_ids else []
    role_by_id = {r.id: r for r in roles}
    payload_players = [
        {
            "id": str(p.id),
            "name": p.name,
            "role": {"name": role_by_id[p.role_id].name, "team": role_by_id[p.role_id].team} if p.role_id else None,
            "status": p.status,
        }
        for p in players
    ]
    db.add(
        GameEvent(
            id=uuid.uuid4(),
            session_id=session.id,
            phase_id=phase.id if phase else None,
            event_type="game_finished",
            payload={"winner": winner, "players": payload_players},
        )
    )
    await db.commit()

    await ws_manager.send_to_session(
        session.id,
        {
            "type": "game_finished",
            "payload": {"winner": winner, "players": payload_players, "announcement": _announcement("game_finished")},
        },
    )
    await timer_service.cancel_all(session.id)
    runtime_state.clear(session.id)

