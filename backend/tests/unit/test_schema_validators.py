from __future__ import annotations

import pytest

from schemas.validators import strip_name_value


def test_strip_whitespace():
    assert strip_name_value("  hello  ") == "hello"


def test_truncate_to_max_length():
    long = "a" * 50
    assert strip_name_value(long) == "a" * 32


def test_none_returns_none():
    assert strip_name_value(None) is None


def test_empty_string_not_required():
    assert strip_name_value("   ") is None


def test_empty_string_required_raises():
    with pytest.raises(ValueError, match="ник не может быть пустым"):
        strip_name_value("   ", required=True)


def test_required_normal():
    assert strip_name_value("  Nick  ", required=True) == "Nick"


def test_custom_max_length():
    assert strip_name_value("hello world", max_length=5) == "hello"


def test_exact_max_length():
    assert strip_name_value("abc", max_length=3) == "abc"
