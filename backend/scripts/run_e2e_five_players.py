"""E2E: 5 игроков через REST API (регистрация → лобби → старт → ночь → день → голосование …).

С хоста (нужен только пакет ``httpx``; API на http://localhost:8000):

  uv run python scripts/run_e2e_five_players.py

Если ``uv`` не в PATH (Windows / Git Bash):

  python -m uv run python scripts/run_e2e_five_players.py

Без uv: активируйте ``backend/.venv`` или выполните ``pip install httpx``, затем:

  python scripts/run_e2e_five_players.py

Из контейнера backend НЕ используйте ``uv run`` для этого скрипта: uv пересоздаст общий
``.venv`` с работающим uvicorn и запросы зависнут (ReadTimeout). Запускайте уже установленным Python:

  docker compose exec backend .venv/bin/python scripts/run_e2e_five_players.py

Переменные окружения:
  BASE_URL — по умолчанию localhost; если виден ``/.dockerenv``, то http://127.0.0.1:8000
  E2E_HTTP_TIMEOUT_SEC — таймаут HTTP-клиента (по умолчанию 120)
  E2E_TIMEOUT_SEC — лимит ожидания конца игры (по умолчанию 180)
"""

from __future__ import annotations

import asyncio
import os
import sys
import uuid
from pathlib import Path

import httpx


def _hdr(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _register(client: httpx.AsyncClient, email: str, password: str, nickname: str | None = None) -> str:
    nick = (nickname or email.split("@")[0])[:32]
    r = await client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "nickname": nick},
    )
    r.raise_for_status()
    return r.json()["access_token"]


async def _state(client: httpx.AsyncClient, session_id: str, token: str) -> dict:
    r = await client.get(f"/api/sessions/{session_id}/state", headers=_hdr(token))
    r.raise_for_status()
    return r.json()


async def _night_action(client: httpx.AsyncClient, session_id: str, token: str, target_id: str) -> None:
    r = await client.post(
        f"/api/sessions/{session_id}/night-action",
        headers=_hdr(token),
        json={"target_player_id": target_id},
    )
    if r.status_code == 409:
        return
    r.raise_for_status()


async def _vote(client: httpx.AsyncClient, session_id: str, token: str, target_id: str | None) -> None:
    body: dict = {}
    if target_id is not None:
        body["target_player_id"] = target_id
    r = await client.post(f"/api/sessions/{session_id}/vote", headers=_hdr(token), json=body)
    if r.status_code == 409:
        return
    r.raise_for_status()


def _turn_description(st: dict) -> str:
    """Кратко: чья сейчас подфаза / ночной ход (для лога e2e)."""
    status = st.get("session_status")
    if status == "finished":
        return ""
    ph = st.get("phase") or {}
    ptype = ph.get("type")
    sub = ph.get("sub_phase")
    num = ph.get("number")
    nt = ph.get("night_turn")
    if ptype == "role_reveal":
        return "раскрытие ролей — каждый игрок подтверждает роль (Ack)"
    if ptype == "night":
        step = {
            "mafia": "мафия выбирает жертву",
            "doctor": "доктор лечит",
            "sheriff": "шериф проверяет",
        }.get(nt, f"ночной ход ({nt or '?'})")
        return f"ночь №{num}: ход — {step}"
    if ptype == "day":
        if sub == "discussion":
            return f"день №{num}: обсуждение (ход у всех живых)"
        if sub == "voting":
            return f"день №{num}: голосование (голосуют все живые)"
    return ""


def _winner_description(code: str | None) -> str:
    if code == "city":
        return "город (мирные, шериф, доктор)"
    if code == "mafia":
        return "мафия"
    return code or "неизвестно"


def _print_final_roster(roster: object) -> None:
    if not isinstance(roster, list) or not roster:
        return
    print("Итог (роли после окончания игры):")
    for row in sorted(roster, key=lambda x: (x.get("name") or "")):
        name = row.get("name") or "?"
        status = row.get("status") or "?"
        role = row.get("role") or {}
        rname = role.get("name") if isinstance(role, dict) else None
        team = role.get("team") if isinstance(role, dict) else None
        role_s = f"{rname} ({team})" if rname else "—"
        print(f"  · {name}: {role_s}, статус: {status}")


def _pick_vote_target(st: dict, my_id: str) -> str | None:
    alive = [p for p in st.get("players", []) if p.get("status") == "alive"]
    others = [p for p in alive if p["id"] != my_id]
    if not others:
        return None
    return others[0]["id"]


async def _play_night_round(
    client: httpx.AsyncClient,
    session_id: str,
    users: list[dict],
) -> None:
    # Порядок совпадает с execute_night_sequence в game_engine.py.
    # Оставляем старые три + новые (don_check, lover_visit, maniac_kill)
    # для универсальности: e2e переживает и 5-, и 7-игрочные сессии.
    order = ("lover_visit", "kill", "don_check", "check", "heal", "maniac_kill")
    for action_type in order:
        for _ in range(40):
            progressed = False
            for u in users:
                try:
                    st = await _state(client, session_id, u["token"])
                except httpx.HTTPStatusError:
                    continue
                if st.get("phase", {}).get("type") != "night":
                    return
                if st.get("action_type") != action_type:
                    continue
                if not st.get("awaiting_action"):
                    continue
                if st.get("my_action_submitted"):
                    continue
                targets = st.get("available_targets") or []
                if not targets:
                    await asyncio.sleep(0.2)
                    continue
                my_pid = st.get("my_player", {}).get("id")
                tid: str | None = None
                if action_type == "heal" and my_pid:
                    others = [t for t in targets if t["player_id"] != my_pid]
                    pick = others[0] if others else targets[0]
                    tid = pick["player_id"]
                else:
                    tid = targets[0]["player_id"]
                await _night_action(client, session_id, u["token"], tid)
                progressed = True
                await asyncio.sleep(0.25)
                break
            if not progressed:
                await asyncio.sleep(0.2)
            else:
                break


async def _play_voting(
    client: httpx.AsyncClient,
    session_id: str,
    users: list[dict],
) -> None:
    st0 = await _state(client, session_id, users[0]["token"])
    if st0.get("phase", {}).get("sub_phase") != "voting":
        return
    my_id = st0["my_player"]["id"]
    target = _pick_vote_target(st0, my_id)
    for u in users:
        try:
            st = await _state(client, session_id, u["token"])
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                continue
            raise
        if st.get("my_player", {}).get("status") != "alive":
            continue
        if st.get("phase", {}).get("sub_phase") != "voting":
            continue
        mid = st["my_player"]["id"]
        t = _pick_vote_target(st, mid) or target
        await _vote(client, session_id, u["token"], t)


def _default_base_url() -> str:
    if os.environ.get("BASE_URL"):
        return os.environ["BASE_URL"].rstrip("/")
    if Path("/.dockerenv").exists():
        return "http://127.0.0.1:8000"
    return "http://localhost:8000"


async def main() -> int:
    base = _default_base_url()
    timeout_sec = float(os.environ.get("E2E_TIMEOUT_SEC", "180"))
    http_timeout = float(os.environ.get("E2E_HTTP_TIMEOUT_SEC", "120"))
    password = os.environ.get("E2E_PASSWORD", "e2etest!1")
    suffix = uuid.uuid4().hex[:10]

    # E2E_PLAYER_COUNT=5 (default) — классическая 5-игрочная.
    # E2E_PLAYER_COUNT=7 — расширенная с don / lover / maniac.
    player_count = int(os.environ.get("E2E_PLAYER_COUNT", "5"))

    t = httpx.Timeout(http_timeout, connect=min(30.0, http_timeout))
    async with httpx.AsyncClient(base_url=base, timeout=t) as client:
        users: list[dict] = []
        for i in range(player_count):
            email = f"e2e_{suffix}_{i}@example.com"
            token = await _register(client, email, password)
            users.append({"email": email, "token": token, "label": f"P{i + 1}"})

        if player_count == 7:
            role_config = {
                "mafia": 1,
                "don": 1,
                "sheriff": 1,
                "doctor": 1,
                "lover": 1,
                "maniac": 1,
            }
        else:
            role_config = {"mafia": 1, "sheriff": 1, "doctor": 1}

        host = users[0]
        create_body = {
            "player_count": player_count,
            "settings": {
                "role_reveal_timer_seconds": 10,
                "discussion_timer_seconds": 30,
                "voting_timer_seconds": 15,
                "night_action_timer_seconds": 15,
                "role_config": role_config,
            },
        }
        r = await client.post("/api/sessions", json=create_body, headers=_hdr(host["token"]))
        r.raise_for_status()
        sess = r.json()
        session_id = sess["id"]
        code = sess["code"]

        for u in users[1:]:
            rj = await client.post(
                f"/api/sessions/{code}/join",
                headers=_hdr(u["token"]),
                json={"name": u["label"]},
            )
            rj.raise_for_status()

        rj = await client.post(
            f"/api/sessions/{code}/join",
            headers=_hdr(host["token"]),
            json={"name": host["label"]},
        )
        rj.raise_for_status()

        rs = await client.post(f"/api/sessions/{session_id}/start", headers=_hdr(host["token"]))
        rs.raise_for_status()

        print(
            "(последний POST /acknowledge-role на сервере ждёт полной 1-й ночи; "
            "строка active:night может не появиться — ночь уже прошла до этого опроса)",
            file=sys.stderr,
        )
        for u in users:
            ra = await client.post(
                f"/api/sessions/{session_id}/acknowledge-role",
                headers=_hdr(u["token"]),
            )
            if ra.status_code == 403:
                continue
            if ra.status_code == 409:
                continue
            ra.raise_for_status()

        started = asyncio.get_event_loop().time()
        last_phase: str | None = None

        while asyncio.get_event_loop().time() - started < timeout_sec:
            st = await _state(client, session_id, users[0]["token"])
            status = st.get("session_status")
            ph = st.get("phase") or {}
            ptype = ph.get("type")
            sub = ph.get("sub_phase")
            nt = ph.get("night_turn")
            winner = st.get("winner")
            roster = st.get("final_roster")

            key = f"{status}:{ptype}:{sub}:{nt}"
            if key != last_phase:
                print(key)
                desc = _turn_description(st)
                if desc:
                    print(f"  … {desc}")
                last_phase = key

            if status == "finished":
                if winner:
                    print(f"Победила команда: {_winner_description(winner)} (winner={winner})")
                _print_final_roster(roster or [])
                print("Игра завершена.")
                return 0

            if ptype == "night":
                await _play_night_round(client, session_id, users)

            elif ptype == "day" and sub == "voting":
                await _play_voting(client, session_id, users)

            await asyncio.sleep(0.4)

        print("Таймаут: игра не закончилась за отведённое время.", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
