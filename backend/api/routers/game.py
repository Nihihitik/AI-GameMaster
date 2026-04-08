from __future__ import annotations

import uuid

"""Роуты игрового цикла (start/ночь/день/state).

Содержит REST-эндпоинты, которые меняют состояние игры.
WebSocket используется только для push-уведомлений.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.deps import get_current_user, get_db
from core.exceptions import GameError
from models.day_vote import DayVote
from models.game_phase import GamePhase
from models.night_action import NightAction
from models.player import Player
from models.role import Role
from models.session import Session
from services.game_engine import acknowledge_role, get_current_phase, start_game, transition_to_voting
from services.runtime_state import runtime_state
from services.ws_manager import ws_manager
from services.state_service import restore_runtime_like_fields


router = APIRouter()


@router.post("/{session_id}/start")
async def start(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.host_user_id != current_user.id:
        raise GameError(403, "not_host", "Только организатор может выполнить это действие")

    await start_game(db, session)
    return {"status": "active", "phase": {"type": "role_reveal", "number": 0}}


@router.post("/{session_id}/acknowledge-role")
async def ack_role(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    if session.status != "active":
        raise GameError(403, "wrong_phase", "Действие недоступно в текущей фазе")

    player = await db.scalar(
        select(Player).where(Player.session_id == session_id, Player.user_id == current_user.id)
    )
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")

    return await acknowledge_role(db, session, player)


@router.post("/{session_id}/night-action")
async def night_action(
    session_id: uuid.UUID,
    payload: dict,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")

    player = await db.scalar(
        select(Player).where(Player.session_id == session_id, Player.user_id == current_user.id)
    )
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")
    if player.status != "alive":
        raise GameError(403, "player_dead", "Выбывшие игроки не могут совершать действия")

    phase = await get_current_phase(db, session_id)
    if not phase or phase.phase_type != "night":
        raise GameError(403, "wrong_phase", "Действие недоступно в текущей фазе")

    target_player_id = payload.get("target_player_id")
    if not target_player_id:
        raise GameError(400, "validation_error", "target_player_id: обязательное поле")
    try:
        target_uuid = uuid.UUID(str(target_player_id))
    except Exception:
        raise GameError(400, "validation_error", "target_player_id: неверный UUID")

    target = await db.get(Player, target_uuid)
    if not target or target.session_id != session_id:
        raise GameError(400, "invalid_target", "Невалидная цель")
    if target.status != "alive":
        raise GameError(400, "invalid_target", "Этот игрок уже выбыл")

    role = await db.get(Role, player.role_id) if player.role_id else None
    action_type = (role.abilities or {}).get("night_action") if role else None
    if not action_type:
        raise GameError(403, "wrong_phase", "Действие недоступно в текущей фазе")

    # ограничения
    if action_type in ("kill", "check") and target.id == player.id:
        raise GameError(400, "invalid_target", "Нельзя выбрать себя")
    if action_type == "kill":
        target_role = await db.get(Role, target.role_id) if target.role_id else None
        if target_role and target_role.team == "mafia":
            raise GameError(400, "invalid_target", "Нельзя атаковать мафию")

    already = await db.scalar(
        select(NightAction.id).where(NightAction.phase_id == phase.id, NightAction.actor_player_id == player.id)
    )
    if already:
        raise GameError(409, "action_already_submitted", "Вы уже сделали выбор в этой фазе")

    # Доктор: нельзя лечить одного и того же игрока 2 ночи подряд.
    # Доктор: себя можно лечить только 1 раз за игру.
    if action_type == "heal":
        # предыдущая ночная фаза этой сессии
        prev_phase = await db.scalar(
            select(GamePhase)
            .where(
                GamePhase.session_id == session_id,
                GamePhase.phase_type == "night",
                GamePhase.phase_number == phase.phase_number - 1,
            )
            .limit(1)
        )
        if prev_phase is not None:
            prev_heal_target = await db.scalar(
                select(NightAction.target_player_id).where(
                    NightAction.phase_id == prev_phase.id,
                    NightAction.actor_player_id == player.id,
                    NightAction.action_type == "heal",
                )
            )
            if prev_heal_target is not None and prev_heal_target == target.id:
                raise GameError(400, "invalid_target", "Нельзя лечить одного и того же игрока два раунда подряд")

        if target.id == player.id:
            self_heal_used = await db.scalar(
                select(NightAction.id)
                .join(GamePhase, NightAction.phase_id == GamePhase.id)
                .where(
                    GamePhase.session_id == session_id,
                    NightAction.actor_player_id == player.id,
                    NightAction.action_type == "heal",
                    NightAction.target_player_id == player.id,
                )
                .limit(1)
            )
            if self_heal_used is not None:
                raise GameError(400, "invalid_target", "Себя доктор может вылечить только один раз за игру")

    # мафия: первый выбор фиксирует общий
    rt = runtime_state.get(session_id)
    if action_type == "kill":
        if rt.mafia_choice_target is not None:
            # кто-то уже выбрал
            raise GameError(409, "action_already_submitted", "Выбор мафии уже сделан")
        rt.mafia_choice_target = target.id
        rt.mafia_choice_by = player.id

    na = NightAction(
        id=uuid.uuid4(),
        phase_id=phase.id,
        actor_player_id=player.id,
        target_player_id=target.id,
        action_type=action_type,
        was_blocked=False,
    )
    db.add(na)
    await db.commit()

    # WS подтверждение
    await ws_manager.send_to_user(session_id, current_user.id, {"type": "action_confirmed", "payload": {"action_type": action_type}})
    rt.night_action_event.set()

    resp = {"action_type": action_type, "target_player_id": str(target.id), "confirmed": True}
    if action_type == "check":
        target_role = await db.get(Role, target.role_id) if target.role_id else None
        team = target_role.team if target_role else "city"
        resp["check_result"] = {"team": team}
        await ws_manager.send_to_user(session_id, current_user.id, {"type": "check_result", "payload": {"target_player_id": str(target.id), "team": team}})
    return resp


@router.post("/{session_id}/vote")
async def vote(
    session_id: uuid.UUID,
    payload: dict,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")
    player = await db.scalar(
        select(Player).where(Player.session_id == session_id, Player.user_id == current_user.id)
    )
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")
    if player.status != "alive":
        raise GameError(403, "player_dead", "Выбывшие игроки не могут совершать действия")

    phase = await get_current_phase(db, session_id)
    if not phase or phase.phase_type != "day":
        raise GameError(403, "wrong_phase", "Действие недоступно в текущей фазе")
    rt = runtime_state.get(session_id)
    if rt.day_sub_phase != "voting":
        raise GameError(403, "wrong_phase", "Действие недоступно в текущей фазе")

    already = await db.scalar(
        select(DayVote.id).where(DayVote.phase_id == phase.id, DayVote.voter_player_id == player.id)
    )
    if already:
        raise GameError(409, "action_already_submitted", "Вы уже сделали выбор в этой фазе")

    target_player_id = payload.get("target_player_id", None)
    target_uuid = None
    if target_player_id is not None:
        try:
            target_uuid = uuid.UUID(str(target_player_id))
        except Exception:
            raise GameError(400, "validation_error", "target_player_id: неверный UUID")
        if target_uuid == player.id:
            raise GameError(400, "invalid_target", "Нельзя голосовать за себя")
        target = await db.get(Player, target_uuid)
        if not target or target.session_id != session_id or target.status != "alive":
            raise GameError(400, "invalid_target", "Невалидная цель")

    dv = DayVote(id=uuid.uuid4(), phase_id=phase.id, voter_player_id=player.id, target_player_id=target_uuid)
    db.add(dv)
    await db.commit()

    # ws vote_update
    from sqlalchemy import func

    votes_cast = await db.scalar(select(func.count(DayVote.id)).where(DayVote.phase_id == phase.id))
    votes_total = await db.scalar(select(func.count(Player.id)).where(Player.session_id == session_id, Player.status == "alive"))
    await ws_manager.send_to_session(session_id, {"type": "vote_update", "payload": {"votes_cast": int(votes_cast or 0), "votes_total": int(votes_total or 0)}})
    if int(votes_cast or 0) >= int(votes_total or 0) and int(votes_total or 0) > 0:
        # закончить досрочно: отменяем таймер голосования и резолвим
        from services.timer_service import timer_service
        from services.game_engine import resolve_votes

        await timer_service.cancel_timer(session_id, "voting")
        await resolve_votes(session_id)
    return {"voter_player_id": str(player.id), "target_player_id": str(target_uuid) if target_uuid else None, "confirmed": True}


@router.get("/{session_id}/state")
async def state(
    session_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session = await db.get(Session, session_id)
    if session is None:
        raise GameError(404, "session_not_found", "Сессия не найдена")

    player = await db.scalar(
        select(Player).where(Player.session_id == session_id, Player.user_id == current_user.id)
    )
    if player is None:
        raise GameError(404, "player_not_found", "Игрок не найден в этой сессии")
    if session.status == "waiting":
        raise GameError(403, "wrong_phase", "Игра ещё не началась")

    phase = await get_current_phase(db, session_id)
    restored = await restore_runtime_like_fields(db, session_id, phase)
    rt = runtime_state.get(session_id)
    # если runtime потерян (рестарт), используем восстановленные значения
    if restored["sub_phase"] is not None:
        rt.day_sub_phase = restored["sub_phase"]
    if restored["night_turn"] is not None:
        rt.night_turn = restored["night_turn"]
    if restored["timer_started_at"] is not None:
        rt.timer_started_at = restored["timer_started_at"]
    if restored["timer_seconds"] is not None:
        rt.timer_seconds = restored["timer_seconds"]

    # роль игрока
    role = await db.get(Role, player.role_id) if player.role_id else None

    all_players = (await db.scalars(select(Player).where(Player.session_id == session_id))).all()

    response = {
        "session_status": session.status,
        "phase": {
            "id": str(phase.id) if phase else None,
            "type": phase.phase_type if phase else None,
            "number": phase.phase_number if phase else None,
            "sub_phase": rt.day_sub_phase if phase and phase.phase_type == "day" else None,
            "night_turn": rt.night_turn if phase and phase.phase_type == "night" else None,
            "started_at": phase.started_at.isoformat() if phase else None,
            "timer_seconds": rt.timer_seconds,
            "timer_started_at": rt.timer_started_at.isoformat() if rt.timer_started_at else None,
        },
        "my_player": {
            "id": str(player.id),
            "name": player.name,
            "status": player.status,
            "role": (
                {"name": role.name, "team": role.team, "abilities": role.abilities}
                if role
                else {"name": None, "team": None, "abilities": {}}
            ),
        },
        "players": [
            {"id": str(p.id), "name": p.name, "status": p.status, "join_order": p.join_order}
            for p in sorted(all_players, key=lambda x: x.join_order)
        ],
        "awaiting_action": False,
        "action_type": None,
        "available_targets": [],
        "my_action_submitted": False,
    }

    if phase and phase.phase_type == "role_reveal":
        from sqlalchemy import func
        from models.game_event import GameEvent

        my_ack = await db.scalar(
            select(GameEvent.id).where(
                GameEvent.session_id == session_id,
                GameEvent.phase_id == phase.id,
                GameEvent.event_type == "role_acknowledged",
                GameEvent.payload["player_id"].astext == str(player.id),
            )
        )
        acked = await db.scalar(
            select(func.count(GameEvent.id)).where(
                GameEvent.session_id == session_id,
                GameEvent.phase_id == phase.id,
                GameEvent.event_type == "role_acknowledged",
            )
        )
        response["role_reveal"] = {
            "my_acknowledged": my_ack is not None,
            "players_acknowledged": int(acked or 0),
            "players_total": len(all_players),
        }

    # awaiting action during night turn
    if phase and phase.phase_type == "night" and role:
        night_action = (role.abilities or {}).get("night_action")
        if night_action:
            response["action_type"] = night_action
            response["awaiting_action"] = True
            if night_action == "kill":
                # цели: живые city
                targets = []
                for p in all_players:
                    if p.status != "alive":
                        continue
                    if p.id == player.id:
                        continue
                    pr = await db.get(Role, p.role_id) if p.role_id else None
                    if pr and pr.team == "mafia":
                        continue
                    targets.append({"player_id": str(p.id), "name": p.name})
                response["available_targets"] = targets
            elif night_action == "heal":
                response["available_targets"] = [
                    {"player_id": str(p.id), "name": p.name} for p in all_players if p.status == "alive"
                ]
            elif night_action == "check":
                response["available_targets"] = [
                    {"player_id": str(p.id), "name": p.name}
                    for p in all_players
                    if p.status == "alive" and p.id != player.id
                ]

            submitted = await db.scalar(
                select(NightAction.id).where(
                    NightAction.phase_id == phase.id,
                    NightAction.actor_player_id == player.id,
                )
            )
            response["my_action_submitted"] = submitted is not None

    if phase and phase.phase_type == "day" and rt.day_sub_phase == "voting":
        from sqlalchemy import func

        cast = await db.scalar(select(func.count(DayVote.id)).where(DayVote.phase_id == phase.id))
        total = await db.scalar(
            select(func.count(Player.id)).where(Player.session_id == session_id, Player.status == "alive")
        )
        response["votes"] = {"total_expected": int(total or 0), "cast": int(cast or 0)}

    if session.status == "finished" and phase is None:
        from models.game_event import GameEvent

        lp = await db.scalar(
            select(GamePhase)
            .where(GamePhase.session_id == session_id)
            .order_by(GamePhase.started_at.desc())
            .limit(1)
        )
        if lp:
            response["phase"] = {
                "id": str(lp.id),
                "type": lp.phase_type,
                "number": lp.phase_number,
                "sub_phase": None,
                "night_turn": None,
                "started_at": lp.started_at.isoformat(),
                "timer_seconds": None,
                "timer_started_at": None,
                "closed": True,
            }
        fin = await db.scalar(
            select(GameEvent)
            .where(GameEvent.session_id == session_id, GameEvent.event_type == "game_finished")
            .order_by(GameEvent.created_at.desc())
            .limit(1)
        )
        if fin and isinstance(fin.payload, dict):
            if fin.payload.get("winner"):
                response["winner"] = fin.payload["winner"]
            if fin.payload.get("players"):
                response["final_roster"] = fin.payload["players"]

    return response


