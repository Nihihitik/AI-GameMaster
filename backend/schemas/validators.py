"""Общие валидаторы для Pydantic-схем."""

from __future__ import annotations


def strip_name_value(v: str | None, *, required: bool = False, max_length: int = 32) -> str | None:
    if v is None:
        return None
    s = v.strip()
    if not s:
        if required:
            raise ValueError("ник не может быть пустым")
        return None
    return s[:max_length]
