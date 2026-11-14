import { describe, it, expect } from 'vitest';
import { Calendar, FileText, FolderOpen, Zap } from 'lucide-react';
import { paletteIcon } from '../paletteIcons';

describe('paletteIcon', () => {
  it('uses the command own icon when it has one', () => {
    expect(paletteIcon({ id: 'module:agenda', group: 'Ir para' })).toBe(Calendar);
  });

  it('falls back to the kind of thing: a project, an article', () => {
    expect(paletteIcon({ id: 'project:7', group: 'Projetos' })).toBe(FolderOpen);
    expect(paletteIcon({ id: 'article:9', group: 'Artigos' })).toBe(FileText);
  });

  it('falls back to the group for what a screen registers', () => {
    expect(paletteIcon({ id: 'screen:new-entry', group: 'Nesta tela' })).toBe(Zap);
  });
});
