from sqlalchemy import CheckConstraint

from models.game_event import GameEvent


def test_game_event_type_constraint_allows_player_renamed() -> None:
    constraints = [
        c for c in GameEvent.__table__.constraints
        if isinstance(c, CheckConstraint) and c.name == "ck_game_events_type"
    ]

    assert constraints
    assert "player_renamed" in str(constraints[0].sqltext)
