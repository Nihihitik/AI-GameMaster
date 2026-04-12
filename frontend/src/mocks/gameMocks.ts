import { Role } from '../types/game';

export const mockRoles: Record<string, Role> = {
  mafia: {
    name: 'Мафия',
    team: 'mafia',
    abilities: { night_action: 'kill' },
  },
  don: {
    name: 'Дон Мафии',
    team: 'mafia',
    abilities: { night_action: 'kill' },
  },
  sheriff: {
    name: 'Шериф',
    team: 'city',
    abilities: { night_action: 'check' },
  },
  doctor: {
    name: 'Доктор',
    team: 'city',
    abilities: { night_action: 'heal' },
  },
  civilian: {
    name: 'Мирный житель',
    team: 'city',
    abilities: { night_action: null },
  },
  detective: {
    name: 'Детектив',
    team: 'city',
    abilities: { night_action: 'check' },
  },
  lover: {
    name: 'Любовница',
    team: 'city',
    abilities: { night_action: null },
  },
  maniac: {
    name: 'Маньяк',
    team: 'city',
    abilities: { night_action: 'kill' },
  },
};

export const roleImages: Record<string, string> = {
  'Мафия': '/img/mafia.png',
  'Дон Мафии': '/img/Don_Mafia.png',
  'Шериф': '/img/Detektiv.png',
  'Доктор': '/img/doktor.png',
  'Мирный житель': '/img/Mirny_zhitel.png',
  'Детектив': '/img/Detektiv.png',
  'Любовница': '/img/lyubovnitsa.png',
  'Маньяк': '/img/manyak.png',
};

export const roleDescriptions: Record<string, string> = {
  'Мафия': 'Каждую ночь мафия выбирает жертву для устранения. Мафиози знают друг друга и действуют сообща. Цель — остаться в большинстве.',
  'Дон Мафии': 'Глава мафиозной семьи. Как и обычная мафия, участвует в ночных убийствах, но обладает особым авторитетом среди своих.',
  'Шериф': 'Каждую ночь шериф может проверить одного игрока и узнать, принадлежит ли тот к мафии или мирным жителям.',
  'Доктор': 'Каждую ночь доктор может выбрать одного игрока и защитить его от нападения мафии. Не может лечить одного и того же два раза подряд.',
  'Мирный житель': 'Обычный горожанин. Не имеет специальных способностей, но его голос на дневном голосовании может решить судьбу игры.',
  'Детектив': 'Опытный следователь, способный проверять подозреваемых по ночам. Должен раскрыть мафию прежде, чем будет слишком поздно.',
  'Любовница': 'Каждую ночь может посетить одного игрока, блокируя его ночное действие. Если посетит мафию — может узнать её секрет.',
  'Маньяк': 'Действует в одиночку. Каждую ночь выбирает жертву независимо от мафии. Побеждает, если остаётся последним.',
};

export const cardBackImage = '/img/Obratnaya_storona_karty.png';
