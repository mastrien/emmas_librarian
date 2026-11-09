import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Calendar, FileText, HelpCircle, Home, MessageCircle, Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { HelpModal, helpPageKey } from '../HelpButton';
import { activeModule, RAIL_MODULES, SETTINGS_MODULE, type ModuleKey, type RailModule } from './modules';

const ICONS: Record<ModuleKey, LucideIcon> = {
  home: Home,
  ask: MessageCircle,
  pdfs: FileText,
  agenda: Calendar,
  settings: Settings,
};

const RailLink: React.FC<{ module: RailModule; active: boolean }> = ({ module, active }) => {
  const Icon = ICONS[module.key];
  return (
    <Link
      to={module.to}
      className={`app-rail__item${active ? ' is-active' : ''}`}
      aria-label={module.label}
      title={module.label}
      aria-current={active ? 'page' : undefined}
    >
      <Icon size={20} aria-hidden="true" />
    </Link>
  );
};

const RailButton: React.FC<{ label: string; icon: LucideIcon; onClick: () => void }> = ({
  label,
  icon: Icon,
  onClick,
}) => (
  <button type="button" className="app-rail__item" aria-label={label} title={label} onClick={onClick}>
    <Icon size={20} aria-hidden="true" />
  </button>
);

/**
 * The column of module icons on the left of every screen (redesign, board 150). Replaces the header's
 * "Mais opções" menu: modules on top; news, help and settings at the bottom.
 *
 * @example <ModuleRail onShowChangelog={() => setShowChangelog(true)} />
 */
export const ModuleRail: React.FC<{ onShowChangelog: () => void }> = ({ onShowChangelog }) => {
  const { pathname } = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);
  const active = activeModule(pathname);

  return (
    <nav className="app-rail" aria-label="Módulos">
      {RAIL_MODULES.map((module) => (
        <RailLink key={module.key} module={module} active={active === module.key} />
      ))}
      <div className="app-rail__bottom">
        <RailButton label="Novidades" icon={Sparkles} onClick={onShowChangelog} />
        <RailButton label="Ajuda sobre esta página" icon={HelpCircle} onClick={() => setHelpOpen(true)} />
        <RailLink module={SETTINGS_MODULE} active={active === 'settings'} />
      </div>
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} pageKey={helpPageKey(pathname)} />
    </nav>
  );
};
