import { useGameStore } from '../stores/gameStore';
import { Player, Role, Target } from '../types/game';

function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============ NARRATION TEXTS FROM text.md ============

const _introTexts = [
  'И так... давайте озвучим правила.... Мирные жители и мафия, а также дополнительные роли, слушайте внимательно) Суть игры, в противостоянии команд: горожане стремятся вычислить мафию, а те, напротив, убить всех мирных. Подробнее вы можете ознакомиться в своде правил, у каждого игрока сверху есть иконка описания всех действующих ролей!',
];

const startPhaseTexts = [
  'Я надеюсь, что все запомнили свои роли, определились со своей "личностью", предлагаю начинать игру!',
  'День прошел обычно…, наступила ночь. Город засыпает, всем закрыть глаза!',
];

const loverWakeTexts = [
  'Конечно же, ночью не дремлет любовь)), любовница выходит на работу. Откройте глаза и выберете своего возлюбленного на сегодняшнюю жаркую ночь!',
];
const loverDoneTexts = [
  'Любовница выбрала возлюбленного, у кого-то будет прекрасная ночь! Закрывайте глаза, девушка.',
];

const mafiaPreTexts = [
  'На улице тихо.. ведь город уснул, но ночью не дремлет глубокий район...',
  'Тихое, темное место.. и жуткие звуки в ночи. Фонарь не горит в этой улице, что ж может произойти?',
  'По среди ночи... к вам в дверь постучали, что дальше случиться??... не предполагали...',
  'Пора бы проснуться ночному убийце, а если вас больше - договоритесь!',
  'Как могут вестись здесь ночные дела? В чем суть договоров? А главный здесь я?',
];
const mafiaWakeTexts = ['Мафия, откройте глаза!'];
const mafiaWakeWithDonTexts = ['Дон Мафия, поднимите руку!'];
const mafiaChoiceTexts = [
  'Мафия делает свой выбор... курок уже почти нажат...',
  'Мафия делает свой выбор... нож может пронзить чью-то жизнь',
  'Мафия делает свой выбор... метка ставиться на несчастную жертву...',
];
const mafiaDoneTexts = ['Что жжж, выбор был сделан'];
const mafiaSleepNoDon = [
  'Мафия возвращается домой, закройте глаза',
  'Мафия покидает место преступления, закройте глаза',
  'Мафия убрала улики и закрывает глаза',
];
const mafiaSleepWithDon = [
  'Мафия возвращается домой, закройте глаза, а Дон Мафия, проверьте по списку вашего преследователя!',
  'Мафия покидает место преступления, закройте глаза, а Дон Мафия, проверьте по списку вашего преследователя!',
  'Мафия убрала улики и закрывает глаза, а Дон Мафия, проверьте по списку вашего преследователя!',
];
const donDoneTexts = [
  'К Дон Мафии пришло досье... ответ прочитан..закройте глаза... пора на покой..',
];

const sheriffWakeTexts = [
  'Я надеюсь, уже вся мафия скрылась в ночи, пришло время ночного смотрителя, просыпается шериф!',
];
const sheriffActionTexts = [
  'Шериф, сделайте свой выбор, на кого направлено ваше расследование?',
];
const sheriffDoneTexts = [
  'Шериф уже устал за эту ночь... расследование окончено... закройте глаза',
];

const maniacWakeTexts = [
  'Убийства еще не закончены.. в городе полно сумасшедших людей',
];
const maniacActionTexts = [
  'Маньяк знает все улочки этого темного города,… откройте глаза и выберите вашу сегодняшнюю жертву',
];
const maniacDoneTexts = [
  'Уф… маньяк сделал свой выбор, закрывайте глаза..',
];

const doctorWakeTexts = [
  'Многие уже ушли спать, но доктор все еще работает..Доктор, откройте глаза, чтобы спасти невинную душу',
];
const doctorDoneTexts = ['Доктор отработал смену, закрывайте глаза'];

const nightEndTexts = [
  'Вот и прошла напряженная ночь, город просыпается, пора узнать результаты!',
  'И тааааак, наступает утро…. Город просыпается, улицы оживают… но к сожалению сегодняшней ночью были совершены жестокие преступления, о которых нельзя молчать этим днем',
];

const nightEndTextsLater = [
  'Ночь подходит к своему концу… и наступает утро… какие же новости у нас сегодня?',
];

const discussionStartTexts = [
  'И так, результаты объявлены, переходим к обсуждению!',
];
const discussionEndTexts = [
  'И так, обсуждение закончилось, переходим к голосованию!',
];

const nightStartTexts = [
  'Пришло время ночи! Город засыпает!',
];

// ============ HELPER FUNCTIONS ============

function getAlivePlayers(): Player[] {
  return useGameStore.getState().players.filter((p) => p.status === 'alive');
}

function getAliveTargets(excludeIds: string[] = []): Target[] {
  return getAlivePlayers()
    .filter((p) => !excludeIds.includes(p.id))
    .map((p) => ({ player_id: p.id, name: p.name }));
}

function getPlayerRole(playerId: string): Role | null {
  const assignment = useGameStore.getState().allRolesAssignment;
  return assignment[playerId] || null;
}

function getRoleSlug(role: Role): string {
  const map: Record<string, string> = {
    'Мафия': 'mafia',
    'Дон Мафии': 'don',
    'Шериф': 'sheriff',
    'Доктор': 'doctor',
    'Мирный житель': 'civilian',
    'Любовница': 'lover',
    'Маньяк': 'maniac',
  };
  return map[role.name] || 'civilian';
}

function hasActiveRole(slug: string): boolean {
  const { activeRoles, players, allRolesAssignment } = useGameStore.getState();
  if (!activeRoles.includes(slug)) return false;
  return players.some((p) => {
    const role = allRolesAssignment[p.id];
    return p.status === 'alive' && role && getRoleSlug(role) === slug;
  });
}

function getPlayersWithRole(slug: string): Player[] {
  const { players, allRolesAssignment } = useGameStore.getState();
  return players.filter((p) => {
    const role = allRolesAssignment[p.id];
    return role && getRoleSlug(role) === slug;
  });
}

function getAlivePlayersWithRole(slug: string): Player[] {
  return getPlayersWithRole(slug).filter((p) => p.status === 'alive');
}

function isMyRole(slug: string): boolean {
  const { myRole } = useGameStore.getState();
  if (!myRole) return false;
  return getRoleSlug(myRole) === slug;
}

function checkWinCondition(): 'mafia' | 'city' | 'maniac' | null {
  const alive = getAlivePlayers();
  const { allRolesAssignment, activeRoles } = useGameStore.getState();

  const mafiaAlive = alive.filter((p) => {
    const r = allRolesAssignment[p.id];
    return r && (r.team === 'mafia' || getRoleSlug(r) === 'don');
  });
  const maniacAlive = alive.filter((p) => {
    const r = allRolesAssignment[p.id];
    return r && getRoleSlug(r) === 'maniac';
  });
  const cityAlive = alive.filter((p) => {
    const r = allRolesAssignment[p.id];
    return r && r.team === 'city' && getRoleSlug(r) !== 'maniac';
  });

  const hasManiacRole = activeRoles.includes('maniac');

  if (mafiaAlive.length === 0 && (!hasManiacRole || maniacAlive.length === 0)) {
    return 'city';
  }

  if (hasManiacRole && maniacAlive.length > 0 && alive.length === 2 && maniacAlive.length === 1) {
    return 'maniac';
  }

  if (mafiaAlive.length >= cityAlive.length + maniacAlive.length) {
    return 'mafia';
  }

  return null;
}

// ============ GAME ENGINE ============

let phaseTimeout: ReturnType<typeof setTimeout> | null = null;

function clearPhaseTimeout() {
  if (phaseTimeout) {
    clearTimeout(phaseTimeout);
    phaseTimeout = null;
  }
}

export function startGameCycle() {
  const store = useGameStore.getState();
  const nightNum = 1;
  store.setNightNumber(nightNum);
  store.resetNightState();

  const texts = nightNum === 1
    ? [...startPhaseTexts]
    : [randomPick(nightStartTexts)];

  store.showNarrator(texts, 'night_waiting');

  // After narrator finishes, the advanceNarrator will switch to night_waiting
  // Then we need to start the night action sequence
}

export function beginNightSequence() {
  const store = useGameStore.getState();
  store.resetNightState();

  const nightActions: (() => void)[] = [];

  // Build the sequence of night actions based on active roles
  if (hasActiveRole('lover')) {
    nightActions.push(() => handleLoverPhase());
  }
  nightActions.push(() => handleMafiaPhase());
  if (hasActiveRole('don')) {
    nightActions.push(() => handleDonPhase());
  }
  if (hasActiveRole('sheriff')) {
    nightActions.push(() => handleSheriffPhase());
  }
  if (hasActiveRole('maniac')) {
    nightActions.push(() => handleManiacPhase());
  }
  if (hasActiveRole('doctor')) {
    nightActions.push(() => handleDoctorPhase());
  }

  // Store the action queue
  (window as any).__nightActionQueue = nightActions;
  (window as any).__nightActionIndex = 0;

  executeNextNightAction();
}

function executeNextNightAction() {
  const queue = (window as any).__nightActionQueue as (() => void)[];
  const index = (window as any).__nightActionIndex as number;

  if (!queue || index >= queue.length) {
    resolveNight();
    return;
  }

  queue[index]();
}

export function advanceNightAction() {
  (window as any).__nightActionIndex = ((window as any).__nightActionIndex || 0) + 1;
  executeNextNightAction();
}

// ============ NIGHT PHASES ============

function handleLoverPhase() {
  const store = useGameStore.getState();

  if (isMyRole('lover') && store.myStatus === 'alive') {
    const texts = [...loverWakeTexts];
    store.showNarrator(texts, 'night_action');
    store.setActionType('lover_visit');
    store.setActionLabel('Выберите вашего возлюбленного на эту ночь');
    store.setAvailableTargets(getAliveTargets([store.myPlayerId!]));
    store.setActionSubmitted(false);
    store.setSelectedTarget(null);
  } else {
    const texts = [...loverWakeTexts];
    store.showNarrator(texts, 'night_waiting');
    phaseTimeout = setTimeout(() => {
      // Simulate lover choosing someone
      const targets = getAliveTargets(getAlivePlayersWithRole('lover').map((p) => p.id));
      if (targets.length > 0) {
        const target = randomPick(targets);
        store.setLoverTarget(target.player_id);
        const targetRole = getPlayerRole(target.player_id);
        if (targetRole && targetRole.abilities?.night_action) {
          store.setLoverBlocked(target.player_id);
        }
      }
      const doneTexts = [...loverDoneTexts];
      store.showNarrator(doneTexts, 'night_waiting');
    }, 3000);
  }
}

function handleMafiaPhase() {
  const store = useGameStore.getState();
  const hasDon = hasActiveRole('don');
  const preText = randomPick(mafiaPreTexts);
  const wakeTexts = [preText, ...mafiaWakeTexts];
  if (hasDon) wakeTexts.push(...mafiaWakeWithDonTexts);

  if ((isMyRole('mafia') || isMyRole('don')) && store.myStatus === 'alive') {
    store.showNarrator(wakeTexts, 'night_action');
    store.setActionType('kill');
    store.setActionLabel('Выберите жертву');
    const mafiaIds = [...getAlivePlayersWithRole('mafia'), ...getAlivePlayersWithRole('don')].map((p) => p.id);
    store.setAvailableTargets(getAliveTargets(mafiaIds));
    store.setActionSubmitted(false);
    store.setSelectedTarget(null);
  } else {
    store.showNarrator(wakeTexts, 'night_waiting');
    phaseTimeout = setTimeout(() => {
      const mafiaIds = [...getAlivePlayersWithRole('mafia'), ...getAlivePlayersWithRole('don')].map((p) => p.id);
      const targets = getAliveTargets(mafiaIds);
      if (targets.length > 0) {
        const victim = randomPick(targets);
        store.addNightKill({ player_id: victim.player_id, name: victim.name, killer: 'mafia' });
      }
      const doneTexts = [randomPick(mafiaChoiceTexts), mafiaDoneTexts[0]];
      const sleepTexts = hasDon ? [randomPick(mafiaSleepWithDon)] : [randomPick(mafiaSleepNoDon)];
      store.showNarrator([...doneTexts, ...sleepTexts], 'night_waiting');
    }, 3000);
  }
}

function handleDonPhase() {
  const store = useGameStore.getState();

  if (isMyRole('don') && store.myStatus === 'alive') {
    store.setScreen('night_action');
    store.setActionType('don_check');
    store.setActionLabel('Проверьте, не шериф ли этот игрок?');
    const donIds = getAlivePlayersWithRole('don').map((p) => p.id);
    store.setAvailableTargets(getAliveTargets(donIds));
    store.setActionSubmitted(false);
    store.setSelectedTarget(null);
  } else {
    phaseTimeout = setTimeout(() => {
      store.showNarrator([...donDoneTexts], 'night_waiting');
    }, 3000);
  }
}

function handleSheriffPhase() {
  const store = useGameStore.getState();

  if (isMyRole('sheriff') && store.myStatus === 'alive') {
    store.showNarrator([...sheriffWakeTexts, ...sheriffActionTexts], 'night_action');
    store.setActionType('check');
    store.setActionLabel('На кого направлено ваше расследование?');
    const sheriffIds = getAlivePlayersWithRole('sheriff').map((p) => p.id);
    store.setAvailableTargets(getAliveTargets(sheriffIds));
    store.setActionSubmitted(false);
    store.setSelectedTarget(null);
  } else {
    store.showNarrator([...sheriffWakeTexts], 'night_waiting');
    phaseTimeout = setTimeout(() => {
      store.showNarrator([...sheriffDoneTexts], 'night_waiting');
    }, 3000);
  }
}

function handleManiacPhase() {
  const store = useGameStore.getState();

  if (isMyRole('maniac') && store.myStatus === 'alive') {
    store.showNarrator([...maniacWakeTexts, ...maniacActionTexts], 'night_action');
    store.setActionType('maniac_kill');
    store.setActionLabel('Выберите вашу жертву');
    const maniacIds = getAlivePlayersWithRole('maniac').map((p) => p.id);
    store.setAvailableTargets(getAliveTargets(maniacIds));
    store.setActionSubmitted(false);
    store.setSelectedTarget(null);
  } else {
    store.showNarrator([...maniacWakeTexts], 'night_waiting');
    phaseTimeout = setTimeout(() => {
      const maniacIds = getAlivePlayersWithRole('maniac').map((p) => p.id);
      const targets = getAliveTargets(maniacIds);
      if (targets.length > 0) {
        const victim = randomPick(targets);
        store.addNightKill({ player_id: victim.player_id, name: victim.name, killer: 'maniac' });
      }
      store.showNarrator([...maniacDoneTexts], 'night_waiting');
    }, 3000);
  }
}

function handleDoctorPhase() {
  const store = useGameStore.getState();

  if (isMyRole('doctor') && store.myStatus === 'alive') {
    store.showNarrator([...doctorWakeTexts], 'night_action');
    store.setActionType('heal');
    store.setActionLabel('Кого вы хотите спасти?');
    let targets = getAliveTargets([]);

    // Can't heal same player twice in a row
    if (store.doctorLastHealed) {
      targets = targets.filter((t) => t.player_id !== store.doctorLastHealed);
    }
    // Self-heal only once per game
    if (store.doctorSelfHealUsed) {
      targets = targets.filter((t) => t.player_id !== store.myPlayerId);
    }

    store.setAvailableTargets(targets);
    store.setActionSubmitted(false);
    store.setSelectedTarget(null);
  } else {
    store.showNarrator([...doctorWakeTexts], 'night_waiting');
    phaseTimeout = setTimeout(() => {
      // Simulate doctor healing someone
      const alive = getAlivePlayers();
      if (alive.length > 0) {
        const healed = randomPick(alive);
        store.setNightHealed(healed.id);
      }
      store.showNarrator([...doctorDoneTexts], 'night_waiting');
    }, 3000);
  }
}

// ============ SUBMIT ACTION ============

export function submitNightAction(targetId: string) {
  const store = useGameStore.getState();
  const actionType = store.actionType;

  store.setActionSubmitted(true);
  store.setSelectedTarget(targetId);

  switch (actionType) {
    case 'lover_visit': {
      store.setLoverTarget(targetId);
      const targetRole = getPlayerRole(targetId);
      if (targetRole && targetRole.abilities?.night_action) {
        store.setLoverBlocked(targetId);
      }
      setTimeout(() => {
        store.showNarrator([...loverDoneTexts], 'night_waiting');
      }, 1500);
      break;
    }
    case 'kill': {
      const target = store.availableTargets.find((t) => t.player_id === targetId);
      if (target) {
        store.addNightKill({ player_id: targetId, name: target.name, killer: 'mafia' });
      }
      setTimeout(() => {
        const hasDon = hasActiveRole('don');
        const doneTexts = [randomPick(mafiaChoiceTexts), mafiaDoneTexts[0]];
        const sleepTexts = hasDon ? [randomPick(mafiaSleepWithDon)] : [randomPick(mafiaSleepNoDon)];
        store.showNarrator([...doneTexts, ...sleepTexts], 'night_waiting');
      }, 1500);
      break;
    }
    case 'don_check': {
      const targetRole = getPlayerRole(targetId);
      const isSheriff = targetRole && getRoleSlug(targetRole) === 'sheriff';
      store.addCheckResult({ targetId, team: isSheriff ? 'city' : 'mafia' });
      setTimeout(() => {
        store.showNarrator([...donDoneTexts], 'night_waiting');
      }, 2000);
      break;
    }
    case 'check': {
      const targetRole = getPlayerRole(targetId);
      const team = targetRole ? targetRole.team : 'city';
      const slug = targetRole ? getRoleSlug(targetRole) : 'civilian';
      // Maniac shows as city (green card) to sheriff
      const reportedTeam = (slug === 'maniac') ? 'city' : team;
      store.addCheckResult({ targetId, team: reportedTeam });
      setTimeout(() => {
        store.showNarrator([...sheriffDoneTexts], 'night_waiting');
      }, 2000);
      break;
    }
    case 'maniac_kill': {
      const target = store.availableTargets.find((t) => t.player_id === targetId);
      if (target) {
        store.addNightKill({ player_id: targetId, name: target.name, killer: 'maniac' });
      }
      setTimeout(() => {
        store.showNarrator([...maniacDoneTexts], 'night_waiting');
      }, 1500);
      break;
    }
    case 'heal': {
      store.setNightHealed(targetId);
      store.setDoctorLastHealed(targetId);
      if (targetId === store.myPlayerId) {
        store.setDoctorSelfHealUsed(true);
      }
      setTimeout(() => {
        store.showNarrator([...doctorDoneTexts], 'night_waiting');
      }, 1500);
      break;
    }
  }
}

export function skipMafiaKill() {
  const store = useGameStore.getState();
  store.setMafiaSkippedKill(true);
  store.setMafiaCanSkip(false);
  store.setActionSubmitted(true);
  setTimeout(() => {
    const hasDon = hasActiveRole('don');
    const sleepTexts = hasDon ? [randomPick(mafiaSleepWithDon)] : [randomPick(mafiaSleepNoDon)];
    store.showNarrator([mafiaDoneTexts[0], ...sleepTexts], 'night_waiting');
  }, 1500);
}

// ============ RESOLVE NIGHT ============

function resolveNight() {
  const store = useGameStore.getState();
  const { nightKills, nightHealed, loverTarget, nightNumber } = store;

  // Apply lover logic
  let actualKills = [...nightKills];
  const loverPlayer = getAlivePlayersWithRole('lover')[0];
  let loverDied = false;
  let blockedPlayerName = '';

  if (loverTarget && loverPlayer) {
    // Check if mafia killed lover
    const mafiaKilledLover = actualKills.some(
      (k) => k.player_id === loverPlayer.id && k.killer === 'mafia'
    );

    if (mafiaKilledLover) {
      // Lover dies + the person they visited
      const visitedTarget = store.players.find((p) => p.id === loverTarget);
      if (visitedTarget && !actualKills.some((k) => k.player_id === loverTarget)) {
        actualKills.push({ player_id: loverTarget, name: visitedTarget.name, killer: 'lover_death' });
      }
      loverDied = true;
    } else {
      // Check if mafia targeted the person lover visited
      const mafiaKilledVisited = actualKills.some(
        (k) => k.player_id === loverTarget && k.killer === 'mafia'
      );
      if (mafiaKilledVisited) {
        // Person wasn't home - survives!
        actualKills = actualKills.filter((k) => k.player_id !== loverTarget);
        const visited = store.players.find((p) => p.id === loverTarget);
        blockedPlayerName = visited?.name || '';
      }
    }

    // Block the visited player's actions for the day
    if (!loverDied) {
      store.setDayBlockedPlayer(loverTarget);
    }
  }

  // Apply doctor heal
  if (nightHealed) {
    actualKills = actualKills.filter((k) => k.player_id !== nightHealed);
  }

  // Apply kills
  const died: { player_id: string; name: string }[] = [];
  for (const kill of actualKills) {
    const player = store.players.find((p) => p.id === kill.player_id && p.status === 'alive');
    if (player) {
      store.updatePlayerStatus(kill.player_id, 'dead');
      died.push({ player_id: kill.player_id, name: kill.name });
    }
  }

  store.setNightResultDied(died.length > 0 ? died : null);

  // Build result narration
  const resultTexts: string[] = [];
  const endText = nightNumber === 1 ? randomPick(nightEndTexts) : randomPick(nightEndTextsLater);
  resultTexts.push(endText);

  // Lover special texts
  if (loverTarget && loverPlayer && !loverDied && blockedPlayerName) {
    resultTexts.push(`Сегодня было покушение на жизнь игрока ${blockedPlayerName}, но его не оказалось дома… он провел бурную ночь в другом месте`);
  }
  if (loverTarget && store.dayBlockedPlayer && !loverDied) {
    const blockedP = store.players.find((p) => p.id === store.dayBlockedPlayer);
    if (blockedP && blockedP.status === 'alive') {
      resultTexts.push(`На сегодняшнее голосование не допускается игрок ${blockedP.name}, у него была очень сладкая ночь!`);
    }
  }

  if (died.length === 0) {
    if (nightHealed) {
      resultTexts.push('Сегодня должен был умереть 1 человек, но доктор вовремя приехал на вызов и спас вас!');
    } else {
      resultTexts.push('Этой ночью...... никого не убили... медицинская помощь работает в городе на отлично!');
    }
  } else if (died.length === 1) {
    const diedNames = died.map((d) => d.name);
    const texts = [
      `Сегодня трагично погиб игрок ${diedNames[0]}... доктор не успел спасти невинную душу`,
      `Этой ночью был убит игрок ${diedNames[0]}... скорая помощь приехала на другой вызов`,
      `К сожалению, сегодня убили игрока ${diedNames[0]}, врач приехал на ложный вызов`,
    ];
    resultTexts.push(randomPick(texts));
  } else if (died.length === 2) {
    const names = died.map((d) => d.name);
    if (nightHealed) {
      const savedName = store.players.find((p) => p.id === nightHealed)?.name || 'кого-то';
      resultTexts.push(`Сегодня должно было умереть несколько человек, но доктор вовремя приехал на вызов и спас игрока ${savedName}, но к сожалению игрок ${names[0]} не смог спастись….`);
    } else {
      resultTexts.push(`Сегодня трагично погибли игроки ${names[0]} и ${names[1]}... доктор не успел спасти невинные души`);
    }
  } else {
    const names = died.map((d) => d.name).join(', ');
    resultTexts.push(`К сожалению…. Сегодня погибло ${died.length} игрока… темной стороне посчастливилось убить сразу ${died.length} несчастных ${names}, доктор не смог спасти эти жизни((`);
  }

  store.setNightResultText(resultTexts.join('\n'));

  // Check win condition
  const winner = checkWinCondition();
  if (winner) {
    const winnerText = winner === 'city'
      ? 'Игра окончена! Следующего голосования не будет! В этой игре победили мирные!'
      : winner === 'mafia'
        ? 'Игра окончена! Следующего голосования не будет! В этой игре победила мафия!'
        : 'Игра окончена! Следующего голосования не будет! В этой игре победил маньяк!';
    resultTexts.push(winnerText);
    store.showNarrator(resultTexts, 'finale');
    buildFinaleResult(winner);
    return;
  }

  resultTexts.push(discussionStartTexts[0]);
  store.showNarrator(resultTexts, 'day_discussion');
  store.setDayNumber(store.nightNumber);
}

// ============ DAY PHASE ============

export function startVoting() {
  const store = useGameStore.getState();
  store.showNarrator([...discussionEndTexts], 'day_voting');
  const alivePlayers = getAlivePlayers();
  const myId = store.myPlayerId;
  const blocked = store.dayBlockedPlayer;
  const targets = alivePlayers
    .filter((p) => p.id !== myId && p.id !== blocked)
    .map((p) => ({ player_id: p.id, name: p.name }));
  store.setAvailableTargets(targets);
  store.setVotes({
    total_expected: alivePlayers.filter((p) => p.id !== blocked).length,
    cast: 0,
  });
  store.setVoteSubmitted(false);
  store.setVoteTarget(null);
  store.setVoteCounts({});
}

export function submitVote(targetId: string | null) {
  const store = useGameStore.getState();
  store.setVoteSubmitted(true);
  store.setVoteTarget(targetId);
  if (targetId) {
    store.addVote(targetId);
  }

  // Simulate other players voting
  simulateOtherVotes(targetId);
}

function simulateOtherVotes(myVote: string | null) {
  const store = useGameStore.getState();
  const alive = getAlivePlayers();
  const blocked = store.dayBlockedPlayer;
  const voters = alive.filter((p) => p.id !== store.myPlayerId && p.id !== blocked);
  const targets = alive.filter((p) => p.id !== blocked).map((p) => p.id);

  let delay = 500;
  for (const voter of voters) {
    setTimeout(() => {
      const target = randomPick(targets.filter((t) => t !== voter.id));
      if (target) {
        useGameStore.getState().addVote(target);
      }
      // Check if all votes are in
      const s = useGameStore.getState();
      if (s.votes && s.votes.cast >= s.votes.total_expected - 1) {
        setTimeout(() => resolveVoting(), 1000);
      }
    }, delay);
    delay += 800;
  }
}

function resolveVoting() {
  const store = useGameStore.getState();
  const { voteCounts, nightNumber } = store;

  // Find player with most votes
  let maxVotes = 0;
  let maxPlayers: string[] = [];
  for (const [playerId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      maxPlayers = [playerId];
    } else if (count === maxVotes) {
      maxPlayers.push(playerId);
    }
  }

  const resultTexts: string[] = [];

  if (maxPlayers.length === 1) {
    const eliminated = store.players.find((p) => p.id === maxPlayers[0]);
    if (eliminated) {
      store.updatePlayerStatus(eliminated.id, 'dead');

      const winner = checkWinCondition();
      if (winner) {
        const winText = winner === 'city'
          ? `По результатам голосования, был исключен игрок ${eliminated.name}, Игра окончена! В этой игре победили мирные!`
          : winner === 'mafia'
            ? `По результатам голосования, был исключен игрок ${eliminated.name}, Игра окончена! В этой игре победила мафия!`
            : `По результатам голосования, был исключен игрок ${eliminated.name}, Игра окончена! В этой игре победил маньяк!`;
        resultTexts.push(winText);
        store.showNarrator(resultTexts, 'finale');
        buildFinaleResult(winner);
        return;
      }

      resultTexts.push(`Чтож, по результатам ${nightNumber} голосования был изгнан игрок ${eliminated.name}... игра продолжается…!`);
    }
  } else if (maxPlayers.length > 1) {
    // Tie - random eliminate one
    const randomEliminated = randomPick(maxPlayers);
    const eliminated = store.players.find((p) => p.id === randomEliminated);
    if (eliminated) {
      store.updatePlayerStatus(eliminated.id, 'dead');
      resultTexts.push(`Чтож, горожане, у вас одинаковое количество голосов! Раз вы не сумели договориться, в этом голосовании я исключаю ${eliminated.name}, игра продолжается!`);

      const winner = checkWinCondition();
      if (winner) {
        buildFinaleResult(winner);
        store.showNarrator(resultTexts, 'finale');
        return;
      }
    }
  } else {
    resultTexts.push(`Чтож, по результатам ${nightNumber} голосования участники решили никого не обвинять... игра продолжается…!`);
  }

  // Continue to next night
  resultTexts.push(randomPick(nightStartTexts));
  const nextNight = store.nightNumber + 1;
  store.setNightNumber(nextNight);
  store.resetNightState();
  store.resetDayState();
  store.showNarrator(resultTexts, 'night_waiting');
}

// ============ FINALE ============

function buildFinaleResult(winner: 'mafia' | 'city' | 'maniac') {
  const store = useGameStore.getState();
  const allPlayers = store.players.map((p) => {
    const role = store.allRolesAssignment[p.id];
    return {
      id: p.id,
      name: p.name,
      role: role ? { name: role.name, team: role.team } : { name: 'Мирный житель', team: 'city' as const },
      status: p.status,
      join_order: p.join_order,
    };
  });

  const winnerTeam = winner === 'maniac' ? null : winner;
  store.setResult({
    winner: winnerTeam,
    announcement: {
      audio_url: '',
      text: winner === 'city'
        ? 'Город победил! Все мафиози обезврежены.'
        : winner === 'mafia'
          ? 'Мафия победила! Город пал.'
          : 'Маньяк победил! Все остальные повержены.',
      duration_ms: 5000,
    },
    players: allPlayers,
  });
}

// ============ CLEANUP ============

export function cleanupEngine() {
  clearPhaseTimeout();
  (window as any).__nightActionQueue = null;
  (window as any).__nightActionIndex = 0;
}
