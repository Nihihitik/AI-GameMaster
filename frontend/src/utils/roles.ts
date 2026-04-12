export type RoleTeam = 'mafia' | 'city' | 'maniac';

export interface RoleInfo {
  slug: string;
  backendName: string;
  displayName: string;
  team: RoleTeam;
  card: 'Красная карта' | 'Зелёная карта';
  image: string;
  description: string;
}

export const ROLES: RoleInfo[] = [
  {
    slug: 'civilian',
    backendName: 'Мирный',
    displayName: 'Мирный житель',
    team: 'city',
    card: 'Зелёная карта',
    image: '/img/Mirny_zhitel.png',
    description:
      'Он же горожанин. Когда ведущий объявляет ночь, все жители беспрекословно закрывают глаза.',
  },
  {
    slug: 'mafia',
    backendName: 'Мафия',
    displayName: 'Мафия',
    team: 'mafia',
    card: 'Красная карта',
    image: '/img/mafia.png',
    description:
      'Когда наступает ночь, мафия выбирает одну жертву и может 1 раз пропустить ход за всю игру. Если мафий больше двух, число жертв не меняется.',
  },
  {
    slug: 'sheriff',
    backendName: 'Шериф',
    displayName: 'Шериф',
    team: 'city',
    card: 'Зелёная карта',
    image: '/img/Detektiv.png',
    description:
      'Он играет за команду мирных жителей. Может за ночь проверить любого участника — мафия, дон тот или мирный. Маньяк помечается зелёной картой.',
  },
  {
    slug: 'don',
    backendName: 'Дон',
    displayName: 'Дон Мафии',
    team: 'mafia',
    card: 'Красная карта',
    image: '/img/Don_Mafia.png',
    description:
      'Он же босс мафии. Может проверить любого участника, не шериф ли он. Дон просыпается вместе с Мафией, когда Мафия делает свой выбор.',
  },
  {
    slug: 'doctor',
    backendName: 'Доктор',
    displayName: 'Доктор',
    team: 'city',
    card: 'Зелёная карта',
    image: '/img/doktor.png',
    description:
      'Он указывает на того игрока, которого хочет вылечить. Если ночью в этого участника стреляла мафия, он не погибнет. Два раунда подряд нельзя исцелять одного и того же игрока. Себя доктор лечит один раз за игру.',
  },
  {
    slug: 'lover',
    backendName: 'Любовница',
    displayName: 'Любовница',
    team: 'city',
    card: 'Зелёная карта',
    image: '/img/lyubovnitsa.png',
    description:
      'Если любовница выбирает игрока с активной ролью, тот лишается своей ночной способности и не имеет право на голос в дневном обсуждении. Если мафия выбрала любовницу — умирают оба. Если мафия выбрала того, кого выбрала любовница — никто не умирает (игрока не оказалось дома).',
  },
  {
    slug: 'maniac',
    backendName: 'Маньяк',
    displayName: 'Маньяк',
    team: 'maniac',
    card: 'Красная карта',
    image: '/img/manyak.png',
    description:
      'Просыпается ночью и убивает 1 игрока. Его цель — остаться в живых и довести игру до конца.',
  },
];

export const CARD_BACK_IMAGE = '/img/Obratnaya_storona_karty.png';

export function getRoleInfo(
  role: { slug?: string | null; name?: string | null } | null | undefined,
): RoleInfo | null {
  if (!role) return null;
  if (role.slug) {
    const bySlug = ROLES.find((r) => r.slug === role.slug);
    if (bySlug) return bySlug;
  }
  if (role.name) {
    return (
      ROLES.find((r) => r.backendName === role.name || r.displayName === role.name) ?? null
    );
  }
  return null;
}
