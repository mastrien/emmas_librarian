import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ProjectCategoriesModal } from '../modals/ProjectCategoriesModal';

import { FakeProjectService } from '../../services/__tests__/fakes/FakeProjectService';
import { projectService } from '../../services/api';

const fakeService = FakeProjectService.create();
vi.mock('../../services/api', () => ({
  projectService: {},
}));

const openNewCategory = () => fireEvent.click(screen.getByRole('button', { name: 'Nova categoria' }));
const chooseFromMenu = async (category: string, action: 'Editar' | 'Excluir') => {
  fireEvent.click(await screen.findByRole('button', { name: `Ações de ${category}` }));
  fireEvent.click(screen.getByRole('menuitem', { name: action }));
};

describe('ProjectCategoriesModal', () => {
  beforeEach(() => {
    Object.assign(projectService, fakeService);
    fakeService.reset();
    fakeService.getProjectCategories.mockResolvedValue([{ id: 1, project_id: 1, name: 'Method', type: 'text' }]);
  });

  it('renders categories and allows creating new ones', async () => {
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Method')).toBeInTheDocument();
    });

    openNewCategory();
    const input = screen.getByPlaceholderText('Nome (ex: Metodologia)');
    fireEvent.change(input, { target: { value: 'New Enum Category' } });

    // Change type to enum to show options input
    // By label: the template picker (#46) is also a combobox, above this one.
    fireEvent.change(screen.getByLabelText('Tipo da nova categoria'), { target: { value: 'enum' } });

    const optionsInput = screen.getByPlaceholderText('Opções separadas por vírgula (ex: Qualitativa, Quantitativa)');
    fireEvent.change(optionsInput, { target: { value: 'Opt1, Opt2' } });

    // Button with Plus icon might not have text, we can find by type submit
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find((b) => b.getAttribute('type') === 'submit');
    expect(submitBtn).toBeDefined();

    fakeService.createProjectCategory.mockResolvedValue(2);
    fireEvent.click(submitBtn!);

    await waitFor(() => {
      // It should pass an array of objects
      expect(fakeService.createProjectCategory).toHaveBeenCalledWith(1, 'New Enum Category', 'enum', [
        { name: 'Opt1' },
        { name: 'Opt2' },
      ]);
    });
  });

  // Board 178: a narrow window of lines, each with the type as a badge; the sets and the new category open on demand.
  it('is 470px wide, with each category as a line with its type, and the extras closed', async () => {
    fakeService.getProjectCategories.mockResolvedValue([
      {
        id: 2,
        project_id: 1,
        name: 'Desenho do estudo',
        type: 'enum',
        parsedOptions: [
          { id: 7, name: 'Coorte' },
          { id: 8, name: 'Caso-controle' },
          { id: 9, name: 'Transversal' },
          { id: 10, name: 'Outro' },
        ],
      },
    ]);
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);

    expect(await screen.findByText('Desenho do estudo')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Categorias do Projeto' })).toHaveStyle({ width: '470px' });
    expect(screen.getByText('Lista')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Começar de um modelo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Nova categoria' })).not.toBeInTheDocument();
  });

  it('opens the ready-made sets and the new category form from their buttons, and closes them again', async () => {
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);
    await screen.findByText('Method');

    fireEvent.click(screen.getByRole('button', { name: 'Conjuntos e JSON' }));
    expect(screen.getByRole('heading', { name: 'Começar de um modelo' })).toBeInTheDocument();
    openNewCategory();
    expect(screen.getByRole('form', { name: 'Nova categoria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Começar de um modelo' })).not.toBeInTheDocument();

    openNewCategory();
    expect(screen.queryByRole('form', { name: 'Nova categoria' })).not.toBeInTheDocument();
  });

  it('asks inside the row before deleting, never with a native dialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);

    await chooseFromMenu('Method', 'Excluir');
    expect(fakeService.deleteProjectCategory).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(fakeService.deleteProjectCategory).toHaveBeenCalledWith(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('edits a category in place from its menu, keeping the ids of its options', async () => {
    fakeService.getProjectCategories.mockResolvedValue([
      { id: 3, project_id: 1, name: 'Avaliação', type: 'enum', parsedOptions: [{ id: 5, name: 'Alta' }] },
    ]);
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);

    await chooseFromMenu('Avaliação', 'Editar');
    const form = screen.getByRole('form', { name: 'Editar Avaliação' });
    fireEvent.change(within(form).getByLabelText('Nome da categoria'), { target: { value: 'Avaliação geral' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Adicionar' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Salvar' }));

    await waitFor(() =>
      expect(fakeService.updateProjectCategory).toHaveBeenCalledWith(3, 'Avaliação geral', 'enum', [
        { id: 5, name: 'Alta' },
        { name: 'Nova opção' },
      ]),
    );
  });

  it('says in the modal when a category could not be created, keeping what was typed', async () => {
    fakeService.createProjectCategory.mockRejectedValueOnce(new Error('nome repetido'));
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={() => {}} />);
    await screen.findByText('Method');
    openNewCategory();

    fireEvent.change(screen.getByLabelText('Nome da nova categoria'), { target: { value: 'Method' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar' }));

    expect(await screen.findByRole('status')).toHaveTextContent(/Não foi possível criar a categoria: .*nome repetido/);
    expect(screen.getByLabelText('Nome da nova categoria')).toHaveValue('Method');
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(<ProjectCategoriesModal isOpen={false} projectId={1} onClose={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('says in the subtitle what the categories become and closes with "Concluir" (board 178)', async () => {
    const onClose = vi.fn();
    render(<ProjectCategoriesModal isOpen={true} projectId={1} onClose={onClose} />);

    expect(await screen.findByText('Viram colunas na aba Categorias e perguntas na investigação')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
