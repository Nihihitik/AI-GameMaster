import React, { useState } from 'react';
import './RulesModal.scss';

const rulesContent = {
  general: {
    title: 'Общие правила',
    text: 'Игроки делятся на роли. Мирные жители и мафия, а также дополнительные роли. Каждую ночь ведущий по очереди «будит» активные роли и они используют свои способности. Суть игры Мафия в противостоянии команд: горожане стремятся вычислить мафию, а те, напротив, убить всех мирных. После каждой ночи наступает время обсуждения и голосования. Игроки не раскрывают свои роли.',
  },
  roles: [
    {
      name: 'Мирный житель',
      card: 'Зелёная карта',
      team: 'city',
      description: 'Он же горожанин. Когда ведущий объявляет ночь, все жители беспрекословно закрывают глаза.',
    },
    {
      name: 'Мафия',
      card: 'Красная карта',
      team: 'mafia',
      description: 'Когда наступает ночь, мафия выбирает одну жертву и может 1 раз пропустить ход за всю игру. Если мафий больше двух, число жертв не меняется.',
    },
    {
      name: 'Шериф',
      card: 'Зелёная карта',
      team: 'city',
      description: 'Он играет за команду мирных жителей. Может за ночь проверить любого участника — мафия, дон тот или мирный. Маньяк помечается зелёной картой.',
    },
    {
      name: 'Дон Мафии',
      card: 'Красная карта',
      team: 'mafia',
      description: 'Он же босс мафии. Может проверить любого участника, не шериф ли он. Дон просыпается вместе с Мафией, когда Мафия делает свой выбор.',
    },
    {
      name: 'Доктор',
      card: 'Зелёная карта',
      team: 'city',
      description: 'Он указывает на того игрока, которого хочет вылечить. Если ночью в этого участника стреляла мафия, он не погибнет. Два раунда подряд нельзя исцелять одного и того же игрока. Себя доктор лечит один раз за игру.',
    },
    {
      name: 'Любовница',
      card: 'Зелёная карта',
      team: 'city',
      description: 'Если любовница выбирает игрока с активной ролью, тот лишается своей ночной способности и не имеет право на голос в дневном обсуждении. Если мафия выбрала любовницу — умирают оба. Если мафия выбрала того, кого выбрала любовница — никто не умирает (игрока не оказалось дома).',
    },
    {
      name: 'Маньяк',
      card: 'Красная карта',
      team: 'mafia',
      description: 'Просыпается ночью и убивает 1 игрока. Его цель — остаться в живых и довести игру до конца.',
    },
  ],
  winConditions: [
    { team: 'Мирные жители и Шериф', condition: 'Побеждают, если выгнаны все члены Мафии и Маньяк (выгнаны все красные карты).' },
    { team: 'Мафия и Дон', condition: 'Побеждают, если количество мафиози равно количеству мирных жителей.' },
    { team: 'Маньяк', condition: 'Побеждает, если остаётся 1 на 1 с любым другим игроком.' },
  ],
};

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RulesModal({ isOpen, onClose }: RulesModalProps) {
  const [activeTab, setActiveTab] = useState<'rules' | 'roles' | 'win'>('rules');

  if (!isOpen) return null;

  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-modal__header">
          <h2 className="rules-modal__title">Правила игры</h2>
          <button className="rules-modal__close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="rules-modal__tabs">
          <button
            className={`rules-modal__tab ${activeTab === 'rules' ? 'rules-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('rules')}
          >
            Правила
          </button>
          <button
            className={`rules-modal__tab ${activeTab === 'roles' ? 'rules-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            Роли
          </button>
          <button
            className={`rules-modal__tab ${activeTab === 'win' ? 'rules-modal__tab--active' : ''}`}
            onClick={() => setActiveTab('win')}
          >
            Победа
          </button>
        </div>

        <div className="rules-modal__body">
          {activeTab === 'rules' && (
            <div className="rules-section">
              <h3 className="rules-section__title">{rulesContent.general.title}</h3>
              <p className="rules-section__text">{rulesContent.general.text}</p>
            </div>
          )}

          {activeTab === 'roles' && (
            <div className="rules-roles">
              {rulesContent.roles.map((role) => (
                <div key={role.name} className={`rules-role rules-role--${role.team}`}>
                  <div className="rules-role__header">
                    <span className="rules-role__name">{role.name}</span>
                    <span className={`rules-role__card rules-role__card--${role.team}`}>
                      {role.card}
                    </span>
                  </div>
                  <p className="rules-role__desc">{role.description}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'win' && (
            <div className="rules-win">
              {rulesContent.winConditions.map((wc) => (
                <div key={wc.team} className="rules-win__item">
                  <h4 className="rules-win__team">{wc.team}</h4>
                  <p className="rules-win__condition">{wc.condition}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function RulesButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="rules-btn" onClick={onClick} title="Правила игры">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </button>
  );
}
