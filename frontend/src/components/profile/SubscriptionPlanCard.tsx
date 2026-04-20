import React from 'react';
import './SubscriptionPlanCard.scss';

interface SubscriptionPlanCardProps {
  plan: 'free' | 'pro';
  active: boolean;
  onUpgrade?: () => void;
  upgradeLoading?: boolean;
}

const CheckMark = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const Cross = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const Crown = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M2 20h20l-2-8-4 4-4-8-4 8-4-4z" />
  </svg>
);

const FREE_FEATURES: Array<{ text: string; disabled?: boolean }> = [
  { text: 'Базовые роли (Мафия, Шериф, Доктор)' },
  { text: 'До 12 игроков' },
  { text: '1 игровая сессия одновременно' },
  { text: 'Дополнительные сюжеты', disabled: true },
  { text: 'Новые голоса ведущего', disabled: true },
];

const PRO_FEATURES: Array<{ text: string; disabled?: boolean }> = [
  { text: 'Все базовые роли + Дон, Любовница, Маньяк' },
  { text: 'До 16 игроков' },
  { text: 'До 5 игровых сессий одновременно' },
  { text: 'Эксклюзивные сюжеты' },
  { text: 'Новые голоса ведущего' },
];

export default function SubscriptionPlanCard({
  plan,
  active,
  onUpgrade,
  upgradeLoading = false,
}: SubscriptionPlanCardProps) {
  const isPro = plan === 'pro';
  const features = isPro ? PRO_FEATURES : FREE_FEATURES;

  const classes = [
    'subscription-plan-card',
    isPro ? 'subscription-plan-card--pro' : '',
    active ? 'subscription-plan-card--active' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {isPro && <span className="subscription-plan-card__glow" />}

      <header className="subscription-plan-card__header">
        <h3 className="subscription-plan-card__name">
          {isPro ? 'PRO' : 'Обычная'}
          {isPro && (
            <span className="subscription-plan-card__crown">
              <Crown />
            </span>
          )}
        </h3>
        {isPro ? (
          <div className="subscription-plan-card__price-group">
            <span className="subscription-plan-card__price">149 ₽</span>
            <span className="subscription-plan-card__period">/месяц</span>
          </div>
        ) : (
          <span className="subscription-plan-card__price">Бесплатно</span>
        )}
      </header>

      <ul className="subscription-plan-card__features">
        {features.map((f) => (
          <li
            key={f.text}
            className={f.disabled ? 'subscription-plan-card__feature--disabled' : ''}
          >
            {f.disabled ? <Cross /> : <CheckMark />}
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      {isPro && onUpgrade && (
        <button
          type="button"
          className="subscription-plan-card__upgrade-btn"
          onClick={onUpgrade}
          disabled={upgradeLoading}
        >
          {upgradeLoading ? 'Оформление...' : 'Оформить PRO'}
        </button>
      )}
    </div>
  );
}
