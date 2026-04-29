#!/usr/bin/env python3
"""Сборщик audio_manifest.json для системы озвучки.

Читает frontend/public/audio/, парсит имена файлов по соглашению
``<ключ действия> <id> (<длительность>) <текст>.mp3`` и формирует
JSON с триггерами (variant и name_pair) и списком имён игроков.

Запуск (без установки зависимостей в системный python):
    uv run --with mutagen python scripts/build_audio_manifest.py

Манифест пишется в:
- audio_manifest.json (в корне репо)
- frontend/src/data/audioManifest.json (для импорта во фронт)

Файлы без `(N)` или без текста — пропускаются с warning'ом.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

try:
    from mutagen.mp3 import MP3  # type: ignore
except ImportError:
    print("[ERROR] mutagen не установлен. Запусти: uv run --with mutagen python scripts/build_audio_manifest.py", file=sys.stderr)
    sys.exit(2)


REPO_ROOT = Path(__file__).resolve().parents[1]
AUDIO_ROOT = REPO_ROOT / "frontend" / "public" / "audio"
MANIFEST_ROOT = REPO_ROOT / "audio_manifest.json"
MANIFEST_FRONTEND = REPO_ROOT / "frontend" / "src" / "data" / "audioManifest.json"
# Файл с полными текстами (override). Имена файлов → точный текст реплики.
# Редактируется руками: подставляется в манифест поверх обрезка из имени файла.
TEXTS_OVERRIDE = REPO_ROOT / "audio_texts.json"


# Транслит для slug-ификации.
TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo",
    "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m",
    "н": "n", "о": "o", "п": "p", "р": "r", "с": "s", "т": "t", "у": "u",
    "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "",
    "ы": "y", "ь": "", "э": "e", "ю": "yu", "я": "ya",
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    out = []
    for ch in text:
        if ch in TRANSLIT:
            out.append(TRANSLIT[ch])
        elif ch.isalnum():
            out.append(ch)
        elif ch in (" ", "_", "-"):
            out.append("_")
    s = "".join(out)
    s = re.sub(r"_+", "_", s).strip("_")
    return s


# ─── Имена персонажей ────────────────────────────────────────────────────────
NAMES_GENDER: dict[str, str] = {
    "Анжела": "f",
    "Артём": "m",
    "Валера": "m",
    "Виктор Степанович": "m",
    "Гриша": "m",
    "Дядя Миша": "m",
    "Зинаида Петровна": "f",
    "Марина": "f",
    "Наташа": "f",
    "Олег": "m",
    "Палыч": "m",
    "Светлана": "f",
    "Сеня": "m",
    "Тамара": "f",
    "Толик": "m",
}


# ─── Спецификации триггеров (ночь) ───────────────────────────────────────────
# kind=variant — рандомно выбирается один файл по seed.
# Спецификация: (action_key, kind, prefix). prefix — нормализованное (lowercase) начало
# имени файла без расширения. Сортируется по убыванию длины prefix, чтобы
# конкретные совпадения (например, "мафия закрывает глаза, дон") матчились
# раньше общих ("мафия закрывает глаза").
NIGHT_VARIANTS: list[tuple[str, str]] = [
    # (action_key, prefix)
    ("intro_personality", "вступление личность"),
    ("intro_poem", "вступление стих"),
    ("rules", "правила"),
    ("mafia_exit_poem", "выход мафии стих"),
    ("mafia_and_don_eyes_open", "мафия открывает глаза + дон"),
    ("mafia_eyes_open", "мафия открывает глаза"),
    ("mafia_choose", "выбор мафии"),
    ("mafia_choice_made", "мафия сделала выбор"),
    ("mafia_eyes_close_don_chooses", "мафия закрывает глаза, дон делает выбор"),
    ("mafia_eyes_close", "мафия закрывает глаза"),
    ("don_eyes_close", "дон мафия закрывает глаза"),
    ("sheriff_wakes", "шериф просыпается"),
    ("sheriff_chooses", "шериф делает выбор"),
    ("sheriff_chose", "шериф сделал выбор"),
    ("doctor_eyes_open", "доктор открывает глаза"),
    ("doctor_eyes_close", "доктор закрывает глаза"),
]


# ─── Спецификации триггеров (день) ───────────────────────────────────────────
DAY_VARIANTS: list[tuple[str, str]] = [
    ("no_one_killed_doctor", "никого не убили, доктор спас"),
    ("no_one_killed_doctor", "никого не убили 2 , доктор спас"),
    ("after_night_result", "после результатов ночи"),
    ("after_night_result", "после резальтатов ночи"),  # опечатка в имени файла
    ("after_discussion", "после обсуждения"),
    ("no_accuse", "(5) вы решила никого не обвинять"),  # формат без id
    ("tie_first", "ничья 1 ()"),  # ровно "Ничья 1 ()" — патовая ситуация
    ("end_day_start_night_2", "конец первого дня, начало второй ночи"),
    ("mafia_win_pre", "победа мафии до финального голосования"),
    ("mafia_win_post", "победа мафии после финального голосования"),
    ("city_win_pre", "победа мирных до финального голосования"),
    ("city_win_post", "победа мирных после финального голосования"),
    ("maniac_win_pre", "победа маньяка без финального голосования"),
    ("maniac_win_post", "победа маньяка после финального голосования"),
]


# ─── Name-pair спецификации ──────────────────────────────────────────────────
# Каждый pair имеет opener и closer; склейка: opener → name_audio → closer.
# Для name_pair на бэке выбирается случайная пара по seed, и для жертвы
# подходящего пола (если для пола есть варианты).
NAME_PAIR_SPECS: list[dict] = [
    {
        "action_key": "one_killed",
        "openers": [
            # (gender, prefix_regex)
            ("m", r"^один погибший (?P<pid>\d+) \(\s*(?P<dur>[\d,\.]+)\s*\) (?!продолжение)(?P<text>.+)$"),
            ("f", r"^один погибший (?P<pid>\d+) девушка \(\s*(?P<dur>[\d,\.]+)\s*\) (?!продолжение)(?P<text>.+)$"),
            ("f", r"^один погибший  ?девушка (?P<pid>\d+) \(\s*(?P<dur>[\d,\.]+)\s*\) (?!продолжение)(?P<text>.+)$"),
        ],
        "closers": [
            ("m", r"^один погибший (?P<pid>\d+) продолжение после id \(\s*(?P<dur>[\d,\.]+)\s*\) (?P<text>.+)$"),
            ("m", r"^один погибший (?P<pid>\d+) \(\s*(?P<dur>[\d,\.]+)\s*\) продолжение после id (?P<text>.+)$"),
            ("f", r"^один погибший (?P<pid>\d+) девушка \(\s*(?P<dur>[\d,\.]+)\s*\) продолжение после id (?P<text>.+)$"),
            ("f", r"^один погибший  ?девушка (?P<pid>\d+) \(\s*(?P<dur>[\d,\.]+)\s*\) продолжение после id (?P<text>.+)$"),
        ],
    },
    {
        "action_key": "after_voting",
        "openers": [
            ("any", r"^после голосования (?P<pid>\d+) \(\s*(?P<dur>[\d,\.]+)\s*\) (?!после)(?P<text>.+)$"),
        ],
        "closers": [
            ("any", r"^после голосования (?P<pid>\d+) после озвучки id \(\s*(?P<dur>[\d,\.]+)\s*\) (?P<text>.+)$"),
        ],
    },
    {
        "action_key": "tie_host_kick",
        "openers": [
            ("any", r"^ничья 1\.1 ведущий кикает \((?P<dur>[\d,\.]+)?\) (?P<text>.+)$"),
        ],
        "closers": [
            ("any", r"^ничья 1\.1 после объявления id после решения ведущего \(\s*(?P<dur>[\d,\.]+)\s*\) (?P<text>.+)$"),
        ],
    },
    {
        "action_key": "tie_players_chose",
        "openers": [
            ("any", r"^ничья 1\.2 игроки сами выбрали \(\s*(?P<dur>[\d,\.]+)\s*\) (?P<text>.+)$"),
        ],
        "closers": [
            ("any", r"^ничья 1\.2 после id после фразы, когда игроки сами выбрали кого кикать \(\s*(?P<dur>[\d,\.]+)\s*\) (?P<text>.+)$"),
        ],
    },
]


# ─── Регексы общего парсинга ─────────────────────────────────────────────────
# Длительность: (12) или (24,3) или (24.3). Терпим пробелы внутри скобок.
DURATION_RE = re.compile(r"\(\s*(\d+(?:[,\.]\d+)?)\s*\)")
# id (вариант или pair_id) — первое число после префикса, до пробела/скобки.
ID_RE = re.compile(r"\b(\d+)\b")


@dataclass
class ParsedFile:
    rel_url: str           # "/audio/night/<filename>"
    abs_path: Path
    real_duration_ms: int


@dataclass
class VariantEntry:
    audio_url: str
    duration_ms: int
    text: str
    file_name: str         # для отображения в /ui


@dataclass
class NamePairEntry:
    pair_id: int
    gender: str            # "m" | "f" | "any"
    audio_url: str
    duration_ms: int
    text: str
    file_name: str


def _normalize(name: str) -> str:
    """Приводит имя файла без расширения к нижнему регистру, нормализует пробелы."""
    base = re.sub(r"\s+", " ", name).strip().lower()
    return base


def _read_real_duration_ms(path: Path) -> int:
    audio = MP3(str(path))
    return int(audio.info.length * 1000)


def _filename_duration_ms(name: str) -> int | None:
    m = DURATION_RE.search(name)
    if not m:
        return None
    raw = m.group(1).replace(",", ".")
    try:
        return int(float(raw) * 1000)
    except ValueError:
        return None


def _has_text_after_duration(stem_normalized: str) -> bool:
    """True если после `(N)` в имени есть осмысленный текст."""
    m = re.search(r"\(\s*\d+(?:[,\.]\d+)?\s*\)\s*(.*)$", stem_normalized)
    if not m:
        return False
    rest = m.group(1).strip().rstrip(".").strip()
    return bool(rest)


def _strip_duration_block(text: str) -> str:
    """Убирает '(N)' из строки и нормализует пробелы."""
    return re.sub(r"\s*\(\s*\d+(?:[,\.]\d+)?\s*\)\s*", " ", text).strip()


def _extract_text(stem_normalized: str) -> str:
    """Текст идёт после `(N)`; вернёт чистую фразу, обрезав хвостовые точки/пробелы."""
    m = re.search(r"\(\s*\d+(?:[,\.]\d+)?\s*\)\s*(.*)$", stem_normalized)
    if not m:
        return ""
    txt = m.group(1).strip()
    # удалить начальное "продолжение после id " (для closer без id перед ним)
    txt = re.sub(r"^продолжение после id\s+", "", txt, flags=re.IGNORECASE)
    return txt.strip(" .").strip()


def _try_match_specs(stem_n: str, specs: list[tuple[str, str]]) -> str | None:
    for action_key, prefix in specs:
        if stem_n.startswith(prefix):
            return action_key
    return None


def _try_match_name_pair(stem_n: str) -> tuple[str, str, str, int, int, str] | None:
    """Возвращает (action_key, role, gender, pair_id, duration_ms, text) если совпадение есть."""
    for spec in NAME_PAIR_SPECS:
        for gender, regex in spec["openers"]:
            m = re.match(regex, stem_n, flags=re.IGNORECASE)
            if m:
                pid = int(m.group("pid")) if "pid" in m.groupdict() and m.group("pid") else 1
                dur_raw = m.group("dur") if "dur" in m.groupdict() and m.group("dur") else None
                duration_ms = int(float(dur_raw.replace(",", ".")) * 1000) if dur_raw else 0
                text = m.group("text").strip(" .")
                return (spec["action_key"], "opener", gender, pid, duration_ms, text)
        for gender, regex in spec["closers"]:
            m = re.match(regex, stem_n, flags=re.IGNORECASE)
            if m:
                pid = int(m.group("pid")) if "pid" in m.groupdict() and m.group("pid") else 1
                dur_raw = m.group("dur") if "dur" in m.groupdict() and m.group("dur") else None
                duration_ms = int(float(dur_raw.replace(",", ".")) * 1000) if dur_raw else 0
                text = m.group("text").strip(" .")
                return (spec["action_key"], "closer", gender, pid, duration_ms, text)
    return None


def _try_match_name(stem_n: str) -> tuple[str, str] | None:
    """Возвращает (display_name, gender) если файл — это озвучка имени."""
    for display, gender in NAMES_GENDER.items():
        d_norm = display.lower()
        # Форматы:
        #   "<display> <id> (<dur>) <opt-text>" или "<display> (<dur>)"
        if stem_n.startswith(d_norm + " "):
            rest = stem_n[len(d_norm) + 1 :].strip()
            # rest начинается либо с числа+скобки, либо со скобки
            if re.match(r"^\d+\s*\(", rest) or re.match(r"^\(", rest):
                return (display, gender)
    return None


# Сортировка: длинные prefix'ы матчатся раньше коротких (чтобы
# "мафия закрывает глаза, дон делает выбор" обогнало "мафия закрывает глаза").
NIGHT_VARIANTS_SORTED = sorted(NIGHT_VARIANTS, key=lambda x: len(x[1]), reverse=True)
DAY_VARIANTS_SORTED = sorted(DAY_VARIANTS, key=lambda x: len(x[1]), reverse=True)


def _extract_text_preserving_case(original_stem: str) -> str:
    """Достаёт текст после `(N)` сохраняя регистр оригинала."""
    m = re.search(r"\(\s*\d+(?:[,\.]\d+)?\s*\)\s*(.*)$", original_stem)
    if not m:
        return ""
    txt = m.group(1).strip()
    txt = re.sub(r"^продолжение после id\s+", "", txt, flags=re.IGNORECASE)
    return txt.strip(" .").strip()


def parse_file(path: Path, audio_subdir: str, text_override: str | None = None) -> dict | None:
    """Распознать файл. Если текст в имени отсутствует, но есть text_override —
    используем его и берём длительность из mp3-метаданных через mutagen."""
    stem = path.stem
    stem_n = _normalize(stem)
    stem_orig_norm = re.sub(r"\s+", " ", stem).strip()
    rel_url = f"/audio/{audio_subdir}/{path.name}"
    has_override = bool(text_override)

    # 1. Имя?
    name_match = _try_match_name(stem_n)
    if name_match:
        if not _filename_duration_ms(stem) and not has_override:
            print(f"[skip] {path.name}: нет (N) у имени, пропускаю")
            return None
        return {
            "kind": "name",
            "display": name_match[0],
            "gender": name_match[1],
            "audio_url": rel_url,
            "file_name": path.name,
        }

    # 2. Name-pair?
    pair = _try_match_name_pair(stem_n)
    if pair:
        action_key, role, gender, pid, _dur_from_name, _text_lower = pair
        # Длительность всегда читаем из mp3 через mutagen — `(N)` в имени
        # округляется вниз и ошибается на 0.5–3.5 секунды, из-за чего фронт
        # обрезает аудио на стыке announcement'ов.
        dur_ms = _read_real_duration_ms(path)
        text = _extract_text_preserving_case(stem_orig_norm)
        text = re.sub(r"^продолжение после id\s+", "", text, flags=re.IGNORECASE).strip(" .")
        return {
            "kind": "name_pair",
            "action_key": action_key,
            "role": role,
            "gender": gender,
            "pair_id": pid,
            "audio_url": rel_url,
            "duration_ms": dur_ms,
            "text": text,
            "file_name": path.name,
        }

    # 3. Variant — по префиксу.
    specs = DAY_VARIANTS_SORTED if audio_subdir == "day" else NIGHT_VARIANTS_SORTED
    action_key = _try_match_specs(stem_n, specs)
    if action_key:
        dur_filename = _filename_duration_ms(stem)
        has_text_in_name = _has_text_after_duration(stem_n)
        # Принимаем файл если: либо в имени всё корректно (как раньше),
        # либо есть text_override (тогда читаем длительность из mp3).
        if not dur_filename and not has_override:
            print(f"[skip] {path.name}: нет (N) и нет override в audio_texts.json, пропускаю variant")
            return None
        if not has_text_in_name and not has_override:
            print(f"[skip] {path.name}: нет текста после (N) и нет override, пропускаю variant")
            return None
        # Длительность всегда из mutagen — `(N)` в имени округляется вниз
        # с погрешностью 0.5–3.5 сек, и backend бы обрывал аудио на стыке.
        dur_ms = _read_real_duration_ms(path)
        text = _extract_text_preserving_case(stem_orig_norm) if has_text_in_name else ""
        return {
            "kind": "variant",
            "action_key": action_key,
            "audio_url": rel_url,
            "duration_ms": dur_ms,
            "text": text,
            "file_name": path.name,
        }

    print(f"[warn] не распознано: {path.name}")
    return None


def _load_text_overrides() -> dict[str, str]:
    """Читает audio_texts.json. Если файла нет — пустой dict."""
    if not TEXTS_OVERRIDE.exists():
        return {}
    try:
        raw = json.loads(TEXTS_OVERRIDE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"[ERROR] {TEXTS_OVERRIDE.name} битый JSON: {e}", file=sys.stderr)
        sys.exit(2)
    # Игнорируем мета-ключи (начинаются с "_") — они для документации.
    return {k: v for k, v in raw.items() if not k.startswith("_") and isinstance(v, str)}


def _persist_text_overrides(parsed: list[dict], existing: dict[str, str]) -> None:
    """Создаёт/обновляет audio_texts.json.

    Стратегия:
    - Все существующие записи СОХРАНЯЮТСЯ (даже если файл сейчас пропущен из парсинга —
      запись может «оживить» его на следующем прогоне).
    - Для новых файлов из parsed добавляется default = текст из имени файла.
    - Только записи, для которых mp3-файл вообще удалён из файловой системы,
      остаются в JSON, но это безопасно — они не используются.
    """
    # Стартуем с существующих записей.
    out: dict[str, str] = dict(existing)
    out["_README"] = (
        "Полные тексты реплик ведущего. Ключ — имя mp3-файла, значение — точный текст, "
        "произносимый в аудио. Используется в манифесте и /ui. Если значение пустое или "
        "совпадает с обрезком из имени файла — отредактируй его, чтобы оно совпадало с аудио."
    )
    # Добавляем новые файлы (если их ещё нет).
    for item in parsed:
        fn = item.get("file_name")
        if not fn or fn in out:
            continue
        out[fn] = item.get("text", "")
    # Дополнительно: добавляем все mp3-файлы из директории, которых нет в parsed
    # (skipped по логике парсера) — чтобы пользователь мог дать им override и оживить.
    for subdir in ("night", "day"):
        d = AUDIO_ROOT / subdir
        if not d.exists():
            continue
        for p in sorted(d.glob("*.mp3")):
            if p.name not in out:
                out[p.name] = ""
    TEXTS_OVERRIDE.write_text(
        json.dumps(out, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    print(f"[ok] обновлён {TEXTS_OVERRIDE.relative_to(REPO_ROOT)} ({sum(1 for k in out if not k.startswith('_'))} записей)")


def build_manifest() -> dict:
    if not AUDIO_ROOT.exists():
        print(f"[ERROR] {AUDIO_ROOT} не существует", file=sys.stderr)
        sys.exit(2)

    text_overrides = _load_text_overrides()

    parsed: list[dict] = []
    for subdir in ("night", "day"):
        d = AUDIO_ROOT / subdir
        if not d.exists():
            continue
        for path in sorted(d.glob("*.mp3")):
            override = text_overrides.get(path.name)
            r = parse_file(path, subdir, text_override=override)
            if r:
                # text override: если в audio_texts.json есть запись для этого файла,
                # подставляем её вместо обрезка из имени файла.
                if override:
                    r["text"] = override
                parsed.append(r)

    _persist_text_overrides(parsed, text_overrides)

    # Группируем
    names_by_display: dict[str, dict] = {}
    triggers_variants: dict[str, list[VariantEntry]] = {}
    triggers_pairs_openers: dict[str, list[NamePairEntry]] = {}
    triggers_pairs_closers: dict[str, list[NamePairEntry]] = {}

    for item in parsed:
        if item["kind"] == "name":
            display = item["display"]
            if display in names_by_display:
                continue  # одно имя — одно аудио
            names_by_display[display] = {
                "slug": slugify(display),
                "display": display,
                "gender": item["gender"],
                "intro_audio": item["audio_url"],
                "file_name": item["file_name"],
            }
        elif item["kind"] == "variant":
            triggers_variants.setdefault(item["action_key"], []).append(
                VariantEntry(
                    audio_url=item["audio_url"],
                    duration_ms=item["duration_ms"],
                    text=item["text"],
                    file_name=item["file_name"],
                )
            )
        elif item["kind"] == "name_pair":
            entry = NamePairEntry(
                pair_id=item["pair_id"],
                gender=item["gender"],
                audio_url=item["audio_url"],
                duration_ms=item["duration_ms"],
                text=item["text"],
                file_name=item["file_name"],
            )
            if item["role"] == "opener":
                triggers_pairs_openers.setdefault(item["action_key"], []).append(entry)
            else:
                triggers_pairs_closers.setdefault(item["action_key"], []).append(entry)

    # Заполняем durations для name-аудио (через mutagen)
    for display, info in names_by_display.items():
        path = AUDIO_ROOT / "day" / info["file_name"]
        info["intro_duration_ms"] = _read_real_duration_ms(path)

    # Собираем pairs (для каждого pair_id и gender — opener+closer)
    triggers: dict[str, dict] = {}
    for action, variants in triggers_variants.items():
        triggers[action] = {
            "kind": "variant",
            "variants": [asdict(v) for v in variants],
        }

    for action_key in set(triggers_pairs_openers) | set(triggers_pairs_closers):
        openers = triggers_pairs_openers.get(action_key, [])
        closers = triggers_pairs_closers.get(action_key, [])
        # Группируем по (gender, pair_id)
        opener_by_key = {(o.gender, o.pair_id): o for o in openers}
        closer_by_key = {(c.gender, c.pair_id): c for c in closers}
        pairs = []
        for key in sorted(set(opener_by_key) | set(closer_by_key)):
            opener = opener_by_key.get(key)
            closer = closer_by_key.get(key)
            if not opener or not closer:
                # Попробовать gender=any как fallback
                gender, pid = key
                if not opener:
                    opener = closer_by_key.get(("any", pid)) or opener_by_key.get(("any", pid))
                if not closer:
                    closer = closer_by_key.get(("any", pid)) or closer_by_key.get(("any", pid))
            if not opener or not closer:
                print(f"[warn] {action_key}: незавершённая пара gender={key[0]} pair_id={key[1]}: opener={bool(opener)}, closer={bool(closer)}")
                continue
            pairs.append({
                "id": key[1],
                "gender": key[0],
                "opener": {
                    "audio_url": opener.audio_url,
                    "duration_ms": opener.duration_ms,
                    "text": opener.text,
                    "file_name": opener.file_name,
                },
                "closer": {
                    "audio_url": closer.audio_url,
                    "duration_ms": closer.duration_ms,
                    "text": closer.text,
                    "file_name": closer.file_name,
                },
            })
        if pairs:
            triggers[action_key] = {"kind": "name_pair", "pairs": pairs}

    # Версия = sha от имён + длительностей
    fingerprint = hashlib.sha1()
    for item in sorted(parsed, key=lambda x: x.get("audio_url", "")):
        fingerprint.update(item.get("audio_url", "").encode())
    version = fingerprint.hexdigest()[:12]

    names = list(names_by_display.values())
    names.sort(key=lambda n: n["display"])

    manifest = {
        "version": version,
        "names": names,
        "triggers": triggers,
    }
    return manifest


def write_manifest(manifest: dict) -> None:
    MANIFEST_FRONTEND.parent.mkdir(parents=True, exist_ok=True)
    for path in (MANIFEST_ROOT, MANIFEST_FRONTEND):
        path.write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(f"[ok] записан {path.relative_to(REPO_ROOT)}")


def validate_manifest(manifest: dict) -> list[str]:
    errors: list[str] = []
    expected_names = set(NAMES_GENDER.keys())
    actual_names = {n["display"] for n in manifest["names"]}
    missing = expected_names - actual_names
    if missing:
        errors.append(f"Не найдены аудио для имён: {sorted(missing)}")
    extra = actual_names - expected_names
    if extra:
        errors.append(f"Лишние имена: {sorted(extra)}")
    for action_key, info in manifest["triggers"].items():
        if info["kind"] == "variant" and not info["variants"]:
            errors.append(f"Триггер {action_key}: variant без вариантов")
        if info["kind"] == "name_pair" and not info["pairs"]:
            errors.append(f"Триггер {action_key}: name_pair без пар")
    return errors


def main() -> int:
    manifest = build_manifest()
    errors = validate_manifest(manifest)
    if errors:
        print("\n[VALIDATION ERRORS]", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
    write_manifest(manifest)
    print(f"\n[summary] version={manifest['version']}, names={len(manifest['names'])}, triggers={len(manifest['triggers'])}")
    if errors:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
