from __future__ import annotations

import hashlib
from dataclasses import dataclass


TYPE_SPEED_MS = 45
POST_BUFFER_MS = 1400
MIN_DURATION_MS = 2600
MAX_DURATION_MS = 30000


def _hash_int(raw: str) -> int:
    return int(hashlib.md5(raw.encode()).hexdigest()[:8], 16)


def _pick(options: list[str], seed_key: str) -> str:
    if not options:
        return ""
    return options[_hash_int(seed_key) % len(options)]


def estimate_duration_ms(text: str) -> int:
    estimated = len(text) * TYPE_SPEED_MS + POST_BUFFER_MS
    return max(MIN_DURATION_MS, min(MAX_DURATION_MS, estimated))


@dataclass(slots=True)
class AnnouncementStep:
    key: str
    trigger: str
    text: str
    step_index: int
    steps_total: int
    blocking: bool = True
    duration_ms: int | None = None
    seed: int | None = None

    def to_payload(self) -> dict:
        return {
            "key": self.key,
            "trigger": self.trigger,
            "text": self.text,
            "step_index": self.step_index,
            "steps_total": self.steps_total,
            "blocking": self.blocking,
            "duration_ms": self.duration_ms if self.duration_ms is not None else estimate_duration_ms(self.text),
            "seed": self.seed,
        }


def build_steps(key: str, texts: list[str], seed_key: str, *, blocking: bool = True) -> list[dict]:
    steps_total = len(texts)
    seed = _hash_int(seed_key)
    return [
        AnnouncementStep(
            key=f"{key}:{seed_key}:{index}",
            trigger=key,
            text=text,
            step_index=index,
            steps_total=steps_total,
            blocking=blocking,
            duration_ms=estimate_duration_ms(text),
            seed=seed,
        ).to_payload()
        for index, text in enumerate(texts, start=1)
    ]


def game_started_steps(seed_key: str) -> list[dict]:
    return build_steps(
        "game_started",
        [
            'И так... давайте озвучим правила.... Мирные жители и мафия, а также дополнительные роли, слушайте внимательно) Суть игры, в противостоянии команд: горожане стремятся вычислить мафию, а те, напротив, убить всех мирных. Подробнее вы можете ознакомиться в своде правил, у каждого игрока сверху есть иконка описания всех действующих ролей!',
        ],
        seed_key,
    )


def all_acknowledged_steps(seed_key: str) -> list[dict]:
    return build_steps(
        "all_acknowledged",
        ['Я надеюсь, что все запомнили свои роли, определились со своей "личностью", предлагаю начинать игру!'],
        seed_key,
    )


def night_start_steps(seed_key: str, phase_number: int) -> list[dict]:
    if phase_number == 1:
        texts = [
            "День пройден обычно, спускается ночь,\nИ мирным никто не сумеет помочь.\nГород засыпает, закрываем глазки,\nМафия выходит, надевает маски!"
        ]
    else:
        texts = ["Пришло время ночи! Город засыпает!"]
    return build_steps("night_start", texts, seed_key)


def turn_intro_steps(turn_slug: str, seed_key: str, *, has_don: bool = False) -> list[dict]:
    if turn_slug == "lover":
        texts = [
            "Конечно же, ночью не дремлет любовь, Любви преисполниться тёмная ночь! Любовница, откройте глаза и выберете своего возлюбленного для ночных удовольствий"
        ]
    elif turn_slug == "mafia":
        intro = _pick(
            [
                "На улице тихо, весь город уснул, но в тёмном районе - преступный разгул",
                "На улице тихо.. весь город уснул, но ночью не дремлет глубокий район...",
                "Тихое, темное место.. и жуткие звуки в ночи. Фонарь не горит в этой улице, что ж может произойти?",
                "По среди ночи... к вам в дверь постучали, что дальше случиться??... не предполагали...",
                "Пора бы проснуться ночному убийце, а если вас больше -  договоритесь!",
                "Как могут вестись здесь ночные дела? В чем суть договоров? А главный здесь я?",
            ],
            f"{seed_key}:intro",
        )
        open_eyes = "Мафия, откройте глаза!"
        if has_don:
            open_eyes = f"{open_eyes}\nДон Мафия, поднимите руку!"
        texts = [intro, open_eyes]
    elif turn_slug == "don":
        texts = [
            _pick(
                [
                    "Мафия возвращается домой, закройте глаза, а Дон Мафия, проверьте по списку вашего преследователя!",
                    "Мафия покидает место преступления, закройте глаза, а Дон Мафия, проверьте по списку вашего преследователя!",
                    "Мафия убрала улики и закрывает глаза, а Дон Мафия, проверьте по списку вашего преследователя!",
                ],
                seed_key,
            )
        ]
    elif turn_slug == "sheriff":
        texts = [
            "Я надеюсь, уже вся мафия скрылась в ночи, пришло время ночного смотрителя, просыпается шериф!",
            "Шериф, сделайте свой выбор, на кого направлено ваше расследование?",
        ]
    elif turn_slug == "maniac":
        texts = [
            "Убийства еще не закончены.. в городе полно сумасшедших людей",
            "Маньяк знает все улочки этого темного города,… откройте глаза и выберите вашу сегодняшнюю жертву",
        ]
    elif turn_slug == "doctor":
        texts = [
            _pick(
                [
                    "Многие уже ушли спать, но доктор все еще работает..Доктор, откройте глаза, чтобы спасти невинную душу",
                ],
                seed_key,
            )
        ]
    else:
        texts = []
    return build_steps(f"{turn_slug}_turn", texts, seed_key)


def turn_outro_steps(turn_slug: str, seed_key: str, *, has_don: bool = False) -> list[dict]:
    if turn_slug == "lover":
        texts = ["Любовница выбрала возлюбленного, у кого-то будет прекрасная ночь! Закрывайте глаза, девушка"]
    elif turn_slug == "mafia":
        texts = ["Что ж, выбор был сделан"]
        if not has_don:
            texts.append(
                _pick(
                    [
                        "Мафия возвращается домой, закройте глаза",
                        "Мафия покидает место преступления, закройте глаза",
                        "Мафия убрала улики и закрывает глаза",
                    ],
                    seed_key,
                )
            )
    elif turn_slug == "don":
        texts = ["К Дон Мафии пришло досье... ответ прочитан..закройте глаза... пора на покой.."]
    elif turn_slug == "sheriff":
        texts = ["Шериф уже устал за эту ночь... расследование окончено... закройте глаза"]
    elif turn_slug == "maniac":
        texts = ["Уф… маньяк сделал свой выбор, закрывайте глаза.."]
    elif turn_slug == "doctor":
        texts = ["Доктор отработал смену, закрывайте глаза"]
    else:
        texts = []
    return build_steps(f"{turn_slug}_turn_end", texts, seed_key)


def day_discussion_steps(seed_key: str) -> list[dict]:
    return build_steps("day_discussion_start", ["И так, результаты объявлены, переходим к обсуждению!"], seed_key)


def day_voting_steps(seed_key: str) -> list[dict]:
    return build_steps("day_voting_start", ["И так, обсуждение закончилось, переходим к голосованию!"], seed_key)


def vote_tie_steps(seed_key: str) -> list[dict]:
    return build_steps(
        "vote_tie",
        ["Чтож, горожане, у вас одинаковое количество голосов! Нужно переголосовать! Иначе я сам исключу кого-то))))"],
        seed_key,
    )


def vote_result_steps(
    seed_key: str,
    *,
    eliminated_name: str | None,
    random_elimination: bool = False,
    unanimous_revote: bool = False,
) -> list[dict]:
    if random_elimination and eliminated_name:
        texts = [f"Раз вы не сумели договориться, в этом голосовании я исключаю {eliminated_name}, игра продолжается!"]
    elif unanimous_revote and eliminated_name:
        texts = [f"Горожане пришли к единогласному решению и исключили игрока {eliminated_name}, игра продолжается….!"]
    elif eliminated_name:
        texts = [f"Чтож, по результатам голосования был изгнан игрок {eliminated_name}... игра продолжается…!"]
    else:
        texts = ["Чтож, по результатам голосования участники решили никого не обвинять... игра продолжается…!"]
    return build_steps("vote_result", texts, seed_key)


def game_finished_steps(
    seed_key: str,
    *,
    winner: str,
    eliminated_name: str | None = None,
    before_voting: bool = False,
) -> list[dict]:
    winner_text = {
        "mafia": "В этой игре победила мафия!",
        "city": "В этой игре победили мирные!",
        "maniac": "В этой игре победил маньяк!",
    }.get(winner, "Игра окончена!")
    if before_voting:
        text = f"Игра окончена! Следующего голосования не будет! {winner_text}"
    elif eliminated_name:
        text = f"По результатам голосования, был исключен игрок {eliminated_name}, Игра окончена! {winner_text}"
    else:
        text = f"Игра окончена! {winner_text}"
    return build_steps("game_finished", [text], seed_key)


def night_result_steps(
    seed_key: str,
    *,
    phase_number: int,
    died_names: list[str],
    saved_name: str | None = None,
    blocked_name: str | None = None,
) -> list[dict]:
    texts: list[str] = []
    if phase_number == 1:
        texts.append(
            _pick(
                [
                    "Вот и прошла напряженная ночь, город просыпается, пора узнать результаты!",
                    "И тааааак, наступает утро…. Город просыпается, улицы оживают… но к сожалению сегодняшней ночью были совершены жестокие преступления, о которых нельзя молчать этим днем",
                ],
                f"{seed_key}:morning",
            )
        )
    else:
        texts.append("Ночь подходит к своему концу… и наступает утро… какие же новости у нас сегодня?")

    if saved_name and died_names:
        if len(died_names) == 1:
            texts.append(
                f"Сегодня должно было умереть несколько человек, но доктор вовремя приехал на вызов и спас игрока {saved_name}, но к сожалению игрок {died_names[0]} не смог спастись…."
            )
        else:
            texts.append(f"Сегодня должно было погибнуть 2 игрока {saved_name} и {' и '.join(died_names)}…. Но Доктор вовремя приехал на вызов и спас игрока {saved_name}")
    elif saved_name and not died_names:
        texts.append(
            _pick(
                [
                    "Сегодня должен был умереть 1 человек, но доктор вовремя приехал на вызов и спас вас!",
                    "Этой ночью...... никого не убили... медицинская помощь работает в городе на отлично!",
                ],
                f"{seed_key}:saved",
            )
        )
    elif len(died_names) == 0:
        texts.append("Этой ночью...... никого не убили... медицинская помощь работает в городе на отлично!")
    elif len(died_names) == 1:
        name = died_names[0]
        texts.append(
            _pick(
                [
                    f"Сегодня трагично погиб игрок {name}... доктор не успел спасти невинную душу",
                    f"Этой ночью был убит игрок {name}... скорая помощь приехала на другой вызов",
                    f"К сожалению, сегодня убили игрока {name}, врач приехал на ложный вызов",
                ],
                f"{seed_key}:one_death",
            )
        )
    else:
        names = " и ".join(died_names)
        texts.append(
            _pick(
                [
                    f"Сегодня трагично погибли игроки {names}... доктор не успел спасти невинные души",
                    f"Этой ночью были убиты игроки {names}... скорая помощь приехала на другие вызовы",
                    f"К сожалению, сегодня убили игроков {names}, врач был очень занят другими пациентами",
                ],
                f"{seed_key}:many_deaths",
            )
        )

    if blocked_name:
        texts.append(f"На сегодняшнее голосование не допускается игрок {blocked_name}, у него была очень сладкая ночь!")

    return build_steps("night_result", texts, seed_key)
