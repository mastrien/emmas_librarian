import React from 'react';
import { NavLink } from 'react-router-dom';
import { KeyRound, RefreshCw, ShieldCheck, Sparkles, Sun, Trash2 } from 'lucide-react';
import { SETTINGS_SECTIONS, type SettingsSection } from '../settingsSections';
import { AutosaveNotice } from './AutosaveNotice';
import type { AutosaveStatus } from '../useSettingsAutosave';

const ICONS: Record<SettingsSection, React.ReactNode> = {
  appearance: <Sun size={16} />,
  keys: <KeyRound size={16} />,
  ai: <Sparkles size={16} />,
  backup: <ShieldCheck size={16} />,
  updates: <RefreshCw size={16} />,
  trash: <Trash2 size={16} />,
};

interface SettingsNavProps {
  autosaveStatus: AutosaveStatus;
  appVersion: string;
  /** What each section shows beside its name: "2/4" keys, the items in the trash. */
  counts: Partial<Record<SettingsSection, string>>;
}

/**
 * The list of sections at the left of the settings (board 170), with the saving status under the title, a count where
 * a section has one, and the version at the bottom.
 *
 * @example <SettingsNav autosaveStatus="idle" appVersion="1.3.1" counts={{ keys: '2/4' }} />
 */
export const SettingsNav: React.FC<SettingsNavProps> = ({ autosaveStatus, appVersion, counts }) => (
  <nav className="settings-nav" aria-label="Seções das configurações">
    <div className="settings-nav__head">
      <span className="settings-nav__title">Configurações</span>
      <AutosaveNotice status={autosaveStatus} />
    </div>
    {SETTINGS_SECTIONS.map((section) => (
      <NavLink
        key={section.id}
        to={`/settings/${section.id}`}
        className={({ isActive }) => `settings-nav__item${isActive ? ' is-active' : ''}`}
      >
        {ICONS[section.id]}
        <span className="settings-nav__label">{section.label}</span>
        {/* The space keeps screen readers from reading "Chaves das bases2/4". */}{' '}
        {counts[section.id] && <span className="settings-nav__count">{counts[section.id]}</span>}
      </NavLink>
    ))}
    {appVersion && <span className="settings-nav__version">Emma&apos;s Librarian v{appVersion}</span>}
  </nav>
);
