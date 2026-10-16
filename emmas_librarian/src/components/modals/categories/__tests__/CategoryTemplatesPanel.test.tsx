import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { CategoryTemplatesPanel, type CategoryTemplatesPanelProps } from '../CategoryTemplatesPanel';
import { CATEGORY_TEMPLATES } from '../../../../utils/categoryTemplates';
import type { ProjectCategory } from '../../../../types';

const existing: ProjectCategory[] = [{ id: 1, project_id: 9, name: 'Método', type: 'text' }];

describe('CategoryTemplatesPanel (#46)', () => {
  let alertSpy: MockInstance<(message?: string) => void>;
  let confirmSpy: MockInstance<(message?: string) => boolean>;
  let props: CategoryTemplatesPanelProps;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    props = {
      categories: [],
      applySet: vi.fn().mockResolvedValue({ created: ['População'], skipped: [] }),
      readSetFile: vi.fn().mockResolvedValue(null),
      saveFile: vi.fn().mockResolvedValue(true),
      onApplied: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => vi.restoreAllMocks());

  const click = async (name: string) => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name }));
    });
  };

  it('applies the chosen template to an empty project without asking, then reloads', async () => {
    render(<CategoryTemplatesPanel {...props} />);
    fireEvent.change(screen.getByLabelText('Modelo de categorias'), { target: { value: 'methodological-quality' } });

    await click('Usar modelo');

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(props.applySet).toHaveBeenCalledWith(CATEGORY_TEMPLATES[2].categories);
    expect(alertSpy).toHaveBeenCalledWith('1 categoria criada.');
    expect(props.onApplied).toHaveBeenCalled();
  });

  it('asks before adding to a project that has categories, and does nothing on "no"', async () => {
    confirmSpy.mockReturnValue(false);
    render(<CategoryTemplatesPanel {...props} categories={existing} />);

    await click('Usar modelo');

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Nada é apagado'));
    expect(props.applySet).not.toHaveBeenCalled();
  });

  it('shows why an imported file was refused', async () => {
    props.readSetFile = vi.fn().mockRejectedValue(new Error('[ERR_INVALID_CATEGORY_SET] Tipo desconhecido'));
    render(<CategoryTemplatesPanel {...props} />);

    await click('Importar categorias (JSON)');

    expect(alertSpy).toHaveBeenCalledWith(expect.stringMatching(/Não foi possível importar.*ERR_INVALID_CATEGORY_SET/));
    expect(props.applySet).not.toHaveBeenCalled();
  });

  it('exports the project’s categories as a category set file', async () => {
    render(<CategoryTemplatesPanel {...props} categories={existing} />);

    await click('Exportar categorias (JSON)');

    expect(props.saveFile).toHaveBeenCalledWith(expect.stringContaining('"emma-category-set"'), 'categorias.json');
  });

  it('cannot export a project without categories', () => {
    render(<CategoryTemplatesPanel {...props} />);

    expect(screen.getByRole('button', { name: 'Exportar categorias (JSON)' })).toBeDisabled();
  });
});
