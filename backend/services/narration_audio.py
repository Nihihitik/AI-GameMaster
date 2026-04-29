"""Резолвер trigger → audio (variant / name_pair) для шагов narration_script.

Поведение:
- Для шага с trigger=`<action_key>` ищется запись в audio_manifest.triggers.
- variant: рандомный вариант по seed → подменяется text + duration_ms + audio_url.
- name_pair: opener + name_audio + closer склеиваются в audio_segments;
  text = opener.text + " " + display_name + " " + closer.text.
- Нет записи / нет подходящего пола / нет имени — шаг возвращается как есть
  (только typewriter без аудио).

Все клиенты в сессии получают один и тот же выбор, потому что seed
формируется детерминированно на сервере и широковещательно рассылается.
"""
from __future__ import annotations

import random
from typing import Iterable

from services.audio_manifest import (
    AudioManifest,
    NameAudio,
    NamePairEntry,
    TriggerInfo,
    VariantEntry,
    get_manifest,
)


def _seeded_choice(seed: int | None, items: list):
    if not items:
        return None
    if seed is None:
        return items[0]
    rng = random.Random(seed)
    return rng.choice(items)


def _resolve_variant(info: TriggerInfo, seed: int | None) -> VariantEntry | None:
    return _seeded_choice(seed, info.variants)


def _resolve_pair(
    info: TriggerInfo,
    seed: int | None,
    target_gender: str | None,
) -> NamePairEntry | None:
    if not info.pairs:
        return None
    # Сначала пробуем пары для нужного пола; если их нет — берём any/любой.
    if target_gender:
        candidates = [p for p in info.pairs if p.gender == target_gender]
        if not candidates:
            candidates = [p for p in info.pairs if p.gender == "any"]
        if not candidates:
            candidates = info.pairs
    else:
        candidates = [p for p in info.pairs if p.gender == "any"] or info.pairs
    return _seeded_choice(seed, candidates)


def _name_audio_for(manifest: AudioManifest, display_name: str | None) -> NameAudio | None:
    if not display_name:
        return None
    return manifest.name_by_display(display_name)


def resolve_step(
    step: dict,
    *,
    target_player_name: str | None = None,
    target_player_gender: str | None = None,
    manifest: AudioManifest | None = None,
) -> dict:
    """Вернёт ту же step-копию с дополнительными audio-полями.

    Если триггера нет в манифесте — возвращается step как есть.
    """
    m = manifest or get_manifest()
    trigger = step.get("trigger")
    if not trigger:
        return step
    info = m.trigger(trigger)
    if info is None:
        return step
    seed = step.get("seed")

    if info.kind == "variant":
        v = _resolve_variant(info, seed)
        if v is None:
            return step
        return {
            **step,
            "text": v.text,
            "duration_ms": v.duration_ms,
            "audio_url": v.audio_url,
            "audio_file_name": v.file_name,
        }

    if info.kind == "name_pair":
        # Если по какой-то причине gender игрока неизвестен — пробуем m, f, any.
        gender = target_player_gender
        if not gender and target_player_name:
            n = _name_audio_for(m, target_player_name)
            gender = n.gender if n else None
        pair = _resolve_pair(info, seed, gender)
        if pair is None:
            return step
        name_audio = _name_audio_for(m, target_player_name)
        segments: list[dict] = [
            {"url": pair.opener.audio_url, "duration_ms": pair.opener.duration_ms},
        ]
        if name_audio is not None:
            segments.append(
                {"url": name_audio.intro_audio, "duration_ms": name_audio.intro_duration_ms}
            )
        segments.append(
            {"url": pair.closer.audio_url, "duration_ms": pair.closer.duration_ms}
        )
        total_duration = sum(s["duration_ms"] for s in segments)
        # Текст: opener — пробел — имя — пробел — closer (имя добавляется только если у нас есть display).
        joiners = [pair.opener.text]
        if target_player_name:
            joiners.append(target_player_name)
        joiners.append(pair.closer.text)
        joined_text = " ".join(t for t in joiners if t).strip()
        return {
            **step,
            "text": joined_text,
            "duration_ms": total_duration,
            "audio_url": None,
            "audio_segments": segments,
            "audio_file_name": ", ".join(
                [pair.opener.file_name]
                + ([name_audio.intro_audio.split("/")[-1]] if name_audio else [])
                + [pair.closer.file_name]
            ),
        }

    return step


def resolve_steps(
    steps: list[dict],
    *,
    target_player_name: str | None = None,
    target_player_gender: str | None = None,
) -> list[dict]:
    """Резолв пачки шагов одной фразы. Возвращает копию списка с обогащёнными шагами."""
    m = get_manifest()
    return [
        resolve_step(
            s,
            target_player_name=target_player_name,
            target_player_gender=target_player_gender,
            manifest=m,
        )
        for s in steps
    ]
