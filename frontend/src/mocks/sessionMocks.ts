import { Session, SessionSettings, LobbyPlayer } from '../types/game';
import { CreateSessionResponse, GetSessionResponse, JoinSessionResponse } from '../types/api';

export const mockDefaultSettings: SessionSettings = {
  role_reveal_timer_seconds: 15,
  discussion_timer_seconds: 120,
  voting_timer_seconds: 60,
  night_action_timer_seconds: 30,
  role_config: {
    mafia: 1,
    don: 1,
    sheriff: 1,
    doctor: 1,
    lover: 1,
    maniac: 1,
  },
};

export const mockSession: Session = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  code: 'AX7K2M',
  host_user_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  player_count: 8,
  status: 'waiting',
  settings: mockDefaultSettings,
  created_at: '2026-04-08T12:00:00Z',
};

export const mockCreateSessionResponse: CreateSessionResponse = {
  ...mockSession,
};

export const mockLobbyPlayers: LobbyPlayer[] = [
  { id: 'player-uuid-001', name: 'Вы (Организатор)', join_order: 1, is_host: true },
];

export const mockGetSessionResponse: GetSessionResponse = {
  ...mockSession,
  players: mockLobbyPlayers,
};

export const mockJoinSessionResponse: JoinSessionResponse = {
  player_id: 'player-uuid-009',
  session_id: '550e8400-e29b-41d4-a716-446655440000',
  join_order: 2,
};

export const mockStories = [
  {
    id: 'no-story',
    title: 'Без сюжета',
    description: 'Классическая игра в мафию без дополнительного сюжета.',
    image: '/img/Obratnaya_storona_karty.png',
  },
  {
    id: 'story-1',
    title: 'Тёмный город',
    description: 'В маленьком городке на окраине цивилизации начали происходить загадочные исчезновения. Жители подозревают, что среди них скрываются опасные преступники. Каждую ночь кто-то пропадает без следа...',
    image: '/img/mafia.png',
  },
  {
    id: 'story-2',
    title: 'Поместье тайн',
    description: 'Группа гостей приглашена на закрытую вечеринку в старинное поместье. Но хозяин дома найден мёртвым, а двери заперты. Кто из гостей — убийца?',
    image: '/img/Detektiv.png',
  },
  {
    id: 'story-3',
    title: 'Последний рейс',
    description: 'Пассажиры роскошного круизного лайнера оказались в ловушке посреди океана. Среди них затаились агенты тайной организации с одной целью — устранить свидетелей.',
    image: '/img/Don_Mafia.png',
  },
  {
    id: 'story-4',
    title: 'Зимняя деревня',
    description: 'Изолированная горная деревня отрезана от мира снежной бурей. В одну из ночей бесследно пропал староста. Жители должны найти виновных, пока не стало слишком поздно.',
    image: '/img/doktor.png',
  },
  {
    id: 'story-5',
    title: 'Карнавал масок',
    description: 'На ежегодном венецианском карнавале гости скрывают лица за масками. Но некоторые маски скрывают гораздо более тёмные секреты...',
    image: '/img/lyubovnitsa.png',
  },
];
