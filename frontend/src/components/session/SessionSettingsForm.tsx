import React from 'react';
import Slider from '../ui/Slider';
import Stepper from '../ui/Stepper';
import { SessionSettings, RoleConfig } from '../../types/game';
import {
  MIN_PLAYERS,
  MAX_PLAYERS,
  getSpecialRolesCount,
  getCiviliansCount,
} from '../../stores/sessionStore';
import './SessionSettingsForm.scss';

interface SessionSettingsFormProps {
  settings: SessionSettings;
  onChangeTimers: (partial: Partial<SessionSettings>) => void | Promise<void>;
  onChangeRoleConfig: (key: keyof RoleConfig, value: number) => void | Promise<void>;
  playerCount: number;
  onChangePlayerCount?: (value: number) => void;
  showPlayerCountSlider?: boolean;
  showRolesWarning?: boolean;
  className?: string;
}

export default function SessionSettingsForm({
  settings,
  onChangeTimers,
  onChangeRoleConfig,
  playerCount,
  onChangePlayerCount,
  showPlayerCountSlider = false,
  showRolesWarning = false,
  className,
}: SessionSettingsFormProps) {
  const specialCount = getSpecialRolesCount(settings.role_config);
  const civiliansCount = getCiviliansCount(playerCount, settings.role_config);
  const rolesExceed = specialCount > playerCount;

  const classes = ['settings-form', className ?? ''].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {showPlayerCountSlider && onChangePlayerCount && (
        <section className="settings-form__section">
          <h4 className="settings-form__section-title">Игроки</h4>
          <Slider
            label="Количество игроков"
            value={playerCount}
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            step={1}
            unit="чел"
            onChange={onChangePlayerCount}
          />
        </section>
      )}

      <section className="settings-form__section">
        <h4 className="settings-form__section-title">Таймеры</h4>
        <Slider
          label="Обсуждение"
          value={settings.discussion_timer_seconds}
          min={30}
          max={300}
          step={10}
          onChange={(v) => onChangeTimers({ discussion_timer_seconds: v })}
        />
        <Slider
          label="Голосование"
          value={settings.voting_timer_seconds}
          min={15}
          max={120}
          step={5}
          onChange={(v) => onChangeTimers({ voting_timer_seconds: v })}
        />
        <Slider
          label="Ночные действия"
          value={settings.night_action_timer_seconds}
          min={15}
          max={60}
          step={5}
          onChange={(v) => onChangeTimers({ night_action_timer_seconds: v })}
        />
        <Slider
          label="Ознакомление с ролью"
          value={settings.role_reveal_timer_seconds}
          min={10}
          max={30}
          step={1}
          onChange={(v) => onChangeTimers({ role_reveal_timer_seconds: v })}
        />
      </section>

      <section className="settings-form__section">
        <h4 className="settings-form__section-title">Роли</h4>
        <Stepper
          label="Мафия"
          value={settings.role_config.mafia}
          min={1}
          max={2}
          onChange={(v) => onChangeRoleConfig('mafia', v)}
        />
        <Stepper
          label="Дон Мафии"
          value={settings.role_config.don}
          min={0}
          max={1}
          onChange={(v) => onChangeRoleConfig('don', v)}
        />
        <Stepper
          label="Шериф"
          value={settings.role_config.sheriff}
          min={0}
          max={1}
          onChange={(v) => onChangeRoleConfig('sheriff', v)}
        />
        <Stepper
          label="Доктор"
          value={settings.role_config.doctor}
          min={0}
          max={1}
          onChange={(v) => onChangeRoleConfig('doctor', v)}
        />
        <Stepper
          label="Любовница"
          value={settings.role_config.lover}
          min={0}
          max={1}
          onChange={(v) => onChangeRoleConfig('lover', v)}
        />
        <Stepper
          label="Маньяк"
          value={settings.role_config.maniac}
          min={0}
          max={1}
          onChange={(v) => onChangeRoleConfig('maniac', v)}
        />

        <div className="settings-form__civilians">
          <span className="settings-form__civilians-label">Мирные жители</span>
          <span className="settings-form__civilians-count">{civiliansCount}</span>
        </div>
        <p className="settings-form__hint">В партии должна быть минимум 1 мафия.</p>

        {showRolesWarning && (
          <div className="settings-form__roles-summary">
            <span>Спец. ролей: {specialCount}</span>
            <span>Всего игроков: {playerCount}</span>
            {rolesExceed && (
              <span className="settings-form__roles-warning">
                Спец. ролей больше, чем игроков!
              </span>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
