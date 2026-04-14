from services.narration_script import (
    day_voting_steps,
    game_finished_steps,
    night_result_steps,
    turn_intro_steps,
)


def test_mafia_intro_returns_shared_two_step_sequence() -> None:
    steps = turn_intro_steps("mafia", "session-1:night-1", has_don=True)

    assert len(steps) == 2
    assert steps[0]["step_index"] == 1
    assert steps[1]["step_index"] == 2
    assert steps[1]["steps_total"] == 2
    assert "Дон Мафия" in steps[1]["text"]


def test_night_result_keeps_shared_step_count() -> None:
    steps = night_result_steps(
      "session-1:night-result",
      phase_number=1,
      died_names=["Игрок 1"],
      saved_name=None,
      blocked_name="Игрок 2",
    )

    assert len(steps) == 3
    assert [step["step_index"] for step in steps] == [1, 2, 3]
    assert steps[-1]["text"].endswith("у него была очень сладкая ночь!")


def test_game_finished_pre_vote_phrase_mentions_no_next_vote() -> None:
    steps = game_finished_steps("session-1:finished", winner="mafia", before_voting=True)

    assert len(steps) == 1
    assert "Следующего голосования не будет" in steps[0]["text"]


def test_day_voting_intro_has_single_shared_phrase() -> None:
    steps = day_voting_steps("session-1:day-1")

    assert len(steps) == 1
    assert steps[0]["step_index"] == 1
    assert steps[0]["steps_total"] == 1
