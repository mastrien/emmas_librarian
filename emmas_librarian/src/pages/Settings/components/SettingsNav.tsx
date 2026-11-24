import React from 'react';
import { Link } from 'react-router-dom';
import { KeyRound, RefreshCw, ShieldCheck, Smartphone, Sparkles, Sun, Trash2 } from 'lucide-react';
import { SETTINGS_SECTIONS, type SettingsSection } from '../settingsSections';
import { AutosaveNotice } from './AutosaveNotice';
import type { AutosaveStatus } from '../useSettingsAutosave';

const ICONS: Record<SettingsSection, React.ReactNode> = {
  appearance: <Sun size={16} />,
  keys: <KeyRound size={16} />,
  ai: <Sparkles size={16} />,
  backup: <ShieldCheck size={16} />,
  mobile: <Smartphone size={16} />,
  updates: <RefreshCw size={16} />,
  trash: <Trash2 size={16} />,
};

interface SettingsNavProps {
  /** The section on screen. The address may not name it yet (/settings opens on the default one). */
  current: SettingsSection;
  autosaveStatus: AutosaveStatus;
  appVersion: string;
  /** What each section shows beside its name: "2/4" keys, the items in the trash. */
  counts: Partial<Record<SettingsSection, string>>;
}

/**
 * The list of sections at the left of the settings (board 170), with the saving status under the title, a count where
 * a section has one, and the version at the bottom.
 *
 * @example <SettingsNav current="appearance" autosaveStatus="idle" appVersion="1.3.1" counts={{ keys: '2/4' }} />
 */
export const SettingsNav: React.FC<SettingsNavProps> = ({ current, autosaveStatus, appVersion, counts }) => (
  <nav className="settings-nav" aria-label="Seções das configurações">
    <div className="settings-nav__head">
      <span className="settings-nav__title">Configurações</span>
      <AutosaveNotice status={autosaveStatus} />
    </div>
    {SETTINGS_SECTIONS.map((section) => (
      <Link
        key={section.id}
        to={`/settings/${section.id}`}
        // Not NavLink's isActive: at /settings (no section yet) the default section is shown but the address matches none.
        className={`settings-nav__item${section.id === current ? ' is-active' : ''}`}
        aria-current={section.id === current ? 'page' : undefined}
      >
        {ICONS[section.id]}
        <span className="settings-nav__label">{section.label}</span>
        {/* The space keeps screen readers from reading "Chaves das bases2/4". */}{' '}
        {counts[section.id] && <span className="settings-nav__count">{counts[section.id]}</span>}
      </Link>
    ))}
    {appVersion && <span className="settings-nav__version">Emma&apos;s Librarian v{appVersion}</span>}
  </nav>
);
