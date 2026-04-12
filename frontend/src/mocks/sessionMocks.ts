// Only story entries are kept here; everything else used to be mock-based
// has been removed in favor of real API integration.
// `mockStories` powers the client-side story voting screen (cosmetic only,
// never sent to the backend).

export interface Story {
  id: string;
  title: string;
  description: string;
  image: string;
}

export const mockStories: Story[] = [
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
