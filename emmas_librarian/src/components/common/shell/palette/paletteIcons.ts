import {
  BookOpen,
  Calendar,
  Files,
  FileText,
  FolderOpen,
  GitBranch,
  History,
  Home,
  LayoutGrid,
  ListChecks,
  MessageCircle,
  Plus,
  Scale,
  ScrollText,
  Search,
  Settings,
  Sparkles,
  Tag,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { PaletteCommand, PaletteGroup } from './paletteCommands';

// Board 150 gives every option a small icon: it tells the kind of thing at a glance and keeps the group titles
// apart from the options. The ids are the ones paletteCommands builds.
const BY_ID: Record<string, LucideIcon> = {
  'module:home': Home,
  'module:ask': MessageCircle,
  'module:pdfs': Files,
  'module:agenda': Calendar,
  'module:settings': Settings,
  'section:overview': LayoutGrid,
  'section:articles': FileText,
  'section:categories': Tag,
  'section:diary': BookOpen,
  'section:search': Search,
  'section:history': History,
  'section:review': ListChecks,
  'section:investigation': Sparkles,
  'tool:search': Search,
  'tool:investigation-new': Sparkles,
  'tool:evaluation': Scale,
  'action:new-project': Plus,
  'action:terms': ScrollText,
  'action:guided': ListChecks,
  'action:prisma': GitBranch,
};

const BY_PREFIX: [string, LucideIcon][] = [
  ['project:', FolderOpen],
  ['article:', FileText],
  ['settings:', Settings],
];

const BY_GROUP: Record<PaletteGroup, LucideIcon> = {
  'Nesta tela': Zap,
  'Ir para': Home,
  'Projeto atual': FolderOpen,
  Projetos: FolderOpen,
  Artigos: FileText,
  Executar: Zap,
};

/**
 * The icon of a palette option: its own when the command has one, else the kind of thing it opens.
 *
 * @example paletteIcon({ id: 'module:agenda', group: 'Ir para', label: 'Agenda' }) // Calendar
 */
export function paletteIcon(command: Pick<PaletteCommand, 'id' | 'group'>): LucideIcon {
  const exact = BY_ID[command.id];
  if (exact) return exact;
  const byPrefix = BY_PREFIX.find(([prefix]) => command.id.startsWith(prefix));
  return byPrefix ? byPrefix[1] : BY_GROUP[command.group];
}
