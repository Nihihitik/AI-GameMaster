"""Лоадер audio_manifest.json.

Манифест собирается скриптом ``scripts/build_audio_manifest.py`` из mp3-файлов
в ``frontend/public/audio/``. Здесь — только чтение.
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path

MANIFEST_FILE_NAME = "audio_manifest.json"
logger = logging.getLogger(__name__)


def _default_manifest_path(module_file: Path | None = None) -> Path:
    """Find the manifest in both local repo and Docker layouts."""
    source = (module_file or Path(__file__)).resolve()
    candidates = [
        source.parents[1] / MANIFEST_FILE_NAME,  # /app/audio_manifest.json in Docker
        source.parents[2] / MANIFEST_FILE_NAME,  # repo root when running from backend/
    ]
    for path in candidates:
        try:
            if path.is_file() and path.stat().st_size > 0:
                return path
        except OSError:
            continue
    for path in candidates:
        if path.exists():
            return path
    return candidates[0]


def manifest_path() -> Path:
    override = os.getenv("AUDIO_MANIFEST_PATH")
    if override:
        return Path(override).expanduser()
    return _default_manifest_path()


MANIFEST_PATH = manifest_path()


@dataclass(slots=True, frozen=True)
class NameAudio:
    slug: str
    display: str
    gender: str          # "m" | "f"
    intro_audio: str
    intro_duration_ms: int


@dataclass(slots=True, frozen=True)
class VariantEntry:
    audio_url: str
    duration_ms: int
    text: str
    file_name: str


@dataclass(slots=True, frozen=True)
class PairSegment:
    audio_url: str
    duration_ms: int
    text: str
    file_name: str


@dataclass(slots=True, frozen=True)
class NamePairEntry:
    pair_id: int
    gender: str          # "m" | "f" | "any"
    opener: PairSegment
    closer: PairSegment


@dataclass(slots=True, frozen=True)
class TriggerInfo:
    kind: str            # "variant" | "name_pair"
    variants: list[VariantEntry]
    pairs: list[NamePairEntry]


@dataclass(slots=True, frozen=True)
class AudioManifest:
    version: str
    names: list[NameAudio]
    triggers: dict[str, TriggerInfo]

    def name_by_display(self, display: str) -> NameAudio | None:
        for n in self.names:
            if n.display == display:
                return n
        return None

    def trigger(self, action_key: str) -> TriggerInfo | None:
        return self.triggers.get(action_key)

    def display_names(self) -> list[str]:
        return [n.display for n in self.names]


_cached: AudioManifest | None = None


def _load_from_disk() -> AudioManifest:
    path = manifest_path()
    if not path.exists():
        logger.warning("audio_manifest.missing", extra={"path": str(path)})
        # пустой манифест — вся озвучка fallback'ится на typewriter без аудио
        return AudioManifest(version="empty", names=[], triggers={})
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.exception("audio_manifest.invalid_json", extra={"path": str(path)})
        return AudioManifest(version="invalid", names=[], triggers={})
    names = [
        NameAudio(
            slug=n["slug"],
            display=n["display"],
            gender=n["gender"],
            intro_audio=n["intro_audio"],
            intro_duration_ms=int(n.get("intro_duration_ms") or 0),
        )
        for n in raw.get("names", [])
    ]
    triggers: dict[str, TriggerInfo] = {}
    for action_key, info in (raw.get("triggers") or {}).items():
        kind = info.get("kind")
        if kind == "variant":
            variants = [
                VariantEntry(
                    audio_url=v["audio_url"],
                    duration_ms=int(v["duration_ms"] or 0),
                    text=v["text"],
                    file_name=v["file_name"],
                )
                for v in info.get("variants", [])
            ]
            triggers[action_key] = TriggerInfo(kind="variant", variants=variants, pairs=[])
        elif kind == "name_pair":
            pairs: list[NamePairEntry] = []
            for p in info.get("pairs", []):
                pairs.append(
                    NamePairEntry(
                        pair_id=int(p["id"]),
                        gender=p["gender"],
                        opener=PairSegment(
                            audio_url=p["opener"]["audio_url"],
                            duration_ms=int(p["opener"]["duration_ms"] or 0),
                            text=p["opener"]["text"],
                            file_name=p["opener"]["file_name"],
                        ),
                        closer=PairSegment(
                            audio_url=p["closer"]["audio_url"],
                            duration_ms=int(p["closer"]["duration_ms"] or 0),
                            text=p["closer"]["text"],
                            file_name=p["closer"]["file_name"],
                        ),
                    )
                )
            triggers[action_key] = TriggerInfo(kind="name_pair", variants=[], pairs=pairs)
    return AudioManifest(version=raw.get("version", "empty"), names=names, triggers=triggers)


def get_manifest() -> AudioManifest:
    global _cached
    if _cached is None:
        _cached = _load_from_disk()
    return _cached


def reload_manifest() -> AudioManifest:
    """Сбросить кэш и перечитать с диска (для тестов / hot-reload)."""
    global _cached
    _cached = None
    return get_manifest()


def display_names() -> list[str]:
    return get_manifest().display_names()
