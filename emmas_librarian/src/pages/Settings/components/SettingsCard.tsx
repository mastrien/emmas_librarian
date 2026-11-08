import React from 'react';
import './settings.css';

interface SettingsCardProps {
  title: React.ReactNode;
  /** Drawn before the title; its colour comes from `iconTone`. */
  icon?: React.ReactNode;
  iconTone?: 'primary' | 'danger';
  description?: React.ReactNode;
  /**
   * The cards were written with two spacings and keep them until the redesign decides: "wide" (keys, AI, appearance)
   * leaves more room under the title and the description than "tight" (backup, trash, updates).
   */
  spacing?: 'tight' | 'wide';
  className?: string;
  children: React.ReactNode;
}

/**
 * One section of the settings page: a card with a title, an optional icon and description, then its content.
 *
 * @example <SettingsCard title="Lixeira (Trash Bin)" icon={<Trash2 size={24} />} iconTone="danger">…</SettingsCard>
 */
export const SettingsCard: React.FC<SettingsCardProps> = (props) => {
  const { title, icon, iconTone = 'primary', description, spacing = 'tight', className, children } = props;
  return (
    <div className={['card', 'settings-card', `settings-card--${spacing}`, className].filter(Boolean).join(' ')}>
      <h2 className="settings-card-title">
        {icon && <span className={`settings-card-icon settings-card-icon--${iconTone}`}>{icon}</span>}
        {title}
      </h2>
      {description && <p className="settings-card-description">{description}</p>}
      {children}
    </div>
  );
};
