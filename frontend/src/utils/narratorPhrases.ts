/**
 * Narrator phrases mapped to announcement triggers.
 *
 * IMPORTANT: The backend sends a deterministic `seed` in each announcement
 * so that every client picks the SAME random variant. All players in the
 * same session hear identical phrases.
 *
 * Flow per night turn:
 *   1. Opening phrase(s) → narrator for ALL players
 *   2. Timer starts → action screen for actor, waiting for others
 *   3. Action done / timer expires
 *   4. Closing phrase → narrator for ALL players
 *   5. Next turn
 */

export interface NarratorContext {
  /** Which roles are active in this game (from session settings) */
  activeRoles?: Record<string, number>;
  /** Night result: who died */
  died?: { player_id: string; name: string }[];
  /** Vote result: who was eliminated */
  eliminated?: { player_id: string; name: string } | null;
  /** Game winner */
  winner?: string;
  /** Phase number */
  phaseNumber?: number;
  /** Night turn slug */
  nightTurn?: string;
  /** Day blocked player name (lover block) */
  dayBlockedPlayerName?: string;
  /** Deterministic seed from backend — ensures same random pick for all players */
  seed?: number;
}

/** Deterministic pick: uses seed so every client gets the same variant. */
function pick<T>(arr: T[], seed?: number): T {
  if (seed !== undefined && seed !== null) {
    return arr[Math.abs(seed) % arr.length];
  }
  return arr[Math.floor(Math.random() * arr.length)];
}

function hasRole(ctx: NarratorContext, role: string): boolean {
  return (ctx.activeRoles?.[role] ?? 0) > 0;
}

type PhraseGenerator = (ctx: NarratorContext) => string[];

const PHRASES: Record<string, PhraseGenerator> = {

  // ─── GAME START (rules intro) ──────────────────────────────────────
  // Played AFTER all players acknowledge roles (night 1 only).
  game_started: () => [
    'И так... давайте озвучим правила... Мирные жители и мафия, а также дополнительные роли, слушайте внимательно) Суть игры — в противостоянии команд: горожане стремятся вычислить мафию, а те, напротив, убить всех мирных. Подробнее вы можете ознакомиться в своде правил, у каждого игрока сверху есть иконка описания всех действующих ролей!',
  ],

  // ─── ALL ACKNOWLEDGED (night 1 only) ──────────────────────────────
  all_acknowledged: () => [
    'Я надеюсь, что все запомнили свои роли, определились со своей "личностью", предлагаю начинать игру!',
  ],

  // ─── NIGHT START ───────────────────────────────────────────────────
  // Night 1: poem. Night 2+: fixed phrase.
  night_start: (ctx) => {
    if ((ctx.phaseNumber ?? 1) === 1) {
      return [
        'День пройден обычно, спускается ночь,\nИ мирным никто не сумеет помочь.\nГород засыпает, закрываем глазки,\nМафия выходит, надевает маски!',
      ];
    }
    return ['Пришло время ночи! Город засыпает!'];
  },

  // ─── LOVER TURN (opening) ──────────────────────────────────────────
  lover_turn: () => [
    'Конечно же, ночью не дремлет любовь, Любви преисполниться тёмная ночь! Любовница, откройте глаза и выберете своего возлюбленного для ночных удовольствий',
  ],

  // ─── LOVER TURN END (closing) ──────────────────────────────────────
  lover_turn_end: () => [
    'Любовница выбрала возлюбленного, у кого-то будет прекрасная ночь! Закрывайте глаза, девушка',
  ],

  // ─── MAFIA TURN (opening) ─────────────────────────────────────────
  // 1 random intro + "Мафия, откройте глаза!" + don line if applicable.
  mafia_turn: (ctx) => {
    const s = ctx.seed;
    const intro = pick([
      'На улице тихо, весь город уснул, но в тёмном районе — преступный разгул',
      'На улице тихо.. весь город уснул, но ночью не дремлет глубокий район...',
      'Тихое, темное место.. и жуткие звуки в ночи. Фонарь не горит в этой улице, что ж может произойти?',
      'По среди ночи... к вам в дверь постучали, что дальше случиться??... не предполагали...',
      'Пора бы проснуться ночному убийце, а если вас больше — договоритесь!',
      'Как могут вестись здесь ночные дела? В чем суть договоров? А главный здесь я?',
    ], s);
    if (hasRole(ctx, 'don')) {
      return [intro, 'Мафия, откройте глаза!\nДон Мафия, поднимите руку!'];
    }
    return [intro, 'Мафия, откройте глаза!'];
  },

  // ─── MAFIA TURN END (closing) ──────────────────────────────────────
  // "Что жжж, выбор был сделан" + closing variant.
  // If don exists: don's opening is handled by don_turn trigger.
  mafia_turn_end: (ctx) => {
    const s = ctx.seed;
    const texts = ['Что ж, выбор был сделан'];
    if (!hasRole(ctx, 'don')) {
      texts.push(pick([
        'Мафия возвращается домой, закройте глаза',
        'Мафия покидает место преступления, закройте глаза',
        'Мафия убрала улики и закрывает глаза',
      ], s));
    }
    return texts;
  },

  // ─── DON TURN (opening) ────────────────────────────────────────────
  // Transition from mafia close → don check.
  don_turn: (ctx) => {
    const s = ctx.seed;
    return [pick([
      'Мафия возвращается домой, закройте глаза, а Дон Мафия, проверьте по списку вашего преследователя!',
      'Мафия покидает место преступления, закройте глаза, а Дон Мафия, проверьте по списку вашего преследователя!',
      'Мафия убрала улики и закрывает глаза, а Дон Мафия, проверьте по списку вашего преследователя!',
    ], s)];
  },

  // ─── DON TURN END (closing) ────────────────────────────────────────
  don_turn_end: () => [
    'К Дон Мафии пришло досье... ответ прочитан.. закройте глаза... пора на покой..',
  ],

  // ─── SHERIFF TURN (opening) ────────────────────────────────────────
  sheriff_turn: () => [
    'Я надеюсь, уже вся мафия скрылась в ночи, пришло время ночного смотрителя, просыпается шериф!',
    'Шериф, сделайте свой выбор, на кого направлено ваше расследование?',
  ],

  // ─── SHERIFF TURN END (closing) ────────────────────────────────────
  sheriff_turn_end: () => [
    'Шериф уже устал за эту ночь... расследование окончено... закройте глаза',
  ],

  // ─── MANIAC TURN (opening) ─────────────────────────────────────────
  maniac_turn: () => [
    'Убийства еще не закончены.. в городе полно сумасшедших людей',
    'Маньяк знает все улочки этого темного города,… откройте глаза и выберите вашу сегодняшнюю жертву',
  ],

  // ─── MANIAC TURN END (closing) ─────────────────────────────────────
  maniac_turn_end: () => [
    'Уф… маньяк сделал свой выбор, закрывайте глаза..',
  ],

  // ─── DOCTOR TURN (opening) ─────────────────────────────────────────
  doctor_turn: () => [
    'Многие уже ушли спать, но доктор все еще работает.. Доктор, откройте глаза, чтобы спасти невинную душу',
  ],

  // ─── DOCTOR TURN END (closing) ─────────────────────────────────────
  doctor_turn_end: () => [
    'Доктор отработал смену, закрывайте глаза',
  ],

  // ─── NIGHT RESULT (morning) ────────────────────────────────────────
  // 1 random phrase per condition, same for all players.
  night_result: (ctx) => {
    const s = ctx.seed;
    const texts: string[] = [];
    const pn = ctx.phaseNumber ?? 1;

    if (pn === 1) {
      texts.push(pick([
        'Вот и прошла напряженная ночь, город просыпается, пора узнать результаты!',
        'И тааааак, наступает утро…. Город просыпается, улицы оживают… но к сожалению сегодняшней ночью были совершены жестокие преступления, о которых нельзя молчать этим днем',
      ], s));
    } else {
      texts.push('Ночь подходит к своему концу… и наступает утро… какие же новости у нас сегодня?');
    }

    const died = ctx.died ?? [];
    if (died.length === 0) {
      texts.push(pick([
        'Сегодня должен был умереть 1 человек, но доктор вовремя приехал на вызов и спас вас!',
        'Этой ночью...... никого не убили... медицинская помощь работает в городе на отлично!',
      ], s));
    } else if (died.length === 1) {
      const name = died[0].name;
      texts.push(pick([
        `Сегодня трагично погиб игрок ${name}... доктор не успел спасти невинную душу`,
        `Этой ночью был убит игрок ${name}... скорая помощь приехала на другой вызов`,
        `К сожалению, сегодня убили игрока ${name}, врач приехал на ложный вызов`,
      ], s));
    } else {
      const names = died.map((d) => d.name).join(' и ');
      texts.push(pick([
        `Сегодня трагично погибли игроки ${names}... доктор не успел спасти невинные души`,
        `Этой ночью были убиты игроки ${names}... скорая помощь приехала на другие вызовы`,
        `К сожалению, сегодня убили игроков ${names}, врач был очень занят другими пациентами`,
      ], s));
    }

    if (ctx.dayBlockedPlayerName) {
      texts.push(`На сегодняшнее голосование не допускается игрок ${ctx.dayBlockedPlayerName}, у него была очень сладкая ночь!`);
    }

    return texts;
  },

  // ─── DAY DISCUSSION START ──────────────────────────────────────────
  day_discussion_start: () => [
    'И так, результаты объявлены, переходим к обсуждению!',
  ],

  // ─── DAY VOTING START ──────────────────────────────────────────────
  day_voting_start: () => [
    'И так, обсуждение закончилось, переходим к голосованию!',
  ],

  // ─── VOTE RESULT ───────────────────────────────────────────────────
  vote_result: (ctx) => {
    const el = ctx.eliminated;
    if (el) {
      return [`Чтож, по результатам голосования был изгнан игрок ${el.name}... игра продолжается…!`];
    }
    return ['Чтож, по результатам голосования участники решили никого не обвинять... игра продолжается…!'];
  },

  // ─── GAME FINISHED ─────────────────────────────────────────────────
  game_finished: (ctx) => {
    const w = ctx.winner;
    if (w === 'city') return ['Игра окончена! В этой игре победили мирные!'];
    if (w === 'mafia') return ['Игра окончена! В этой игре победила мафия!'];
    if (w === 'maniac') return ['Игра окончена! В этой игре победил маньяк!'];
    return ['Игра окончена!'];
  },
};

/**
 * Get narrator texts for a given trigger and context.
 * Returns empty array if no phrases for the trigger.
 */
export function getNarratorTexts(trigger: string | undefined, ctx: NarratorContext = {}): string[] {
  if (!trigger) return [];
  const gen = PHRASES[trigger];
  if (!gen) return [];
  return gen(ctx);
}
