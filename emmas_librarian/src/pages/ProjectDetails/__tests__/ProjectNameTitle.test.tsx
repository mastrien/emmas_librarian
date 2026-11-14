import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectNameActions, ProjectNameTitle } from '../components/ProjectNameTitle';

const project = { id: 1, name: 'Test Project', created_at: '2023-01-01T00:00:00.000Z' };

const renameProps = () => ({
  project,
  isEditingName: false,
  setIsEditingName: vi.fn(),
  newName: 'Test Project',
  setNewName: vi.fn(),
  saveName: vi.fn(async () => undefined),
});

describe('ProjectNameTitle', () => {
  it('shows the project name', () => {
    render(<ProjectNameTitle {...renameProps()} />);

    expect(screen.getByText('Test Project')).toBeInTheDocument();
  });

  it('edits the name in a field while renaming', () => {
    const props = renameProps();
    render(<ProjectNameTitle {...props} isEditingName newName="Updated Name" />);

    fireEvent.change(screen.getByRole('textbox', { name: 'Nome do projeto' }), { target: { value: 'Novo' } });

    expect(screen.getByDisplayValue('Updated Name')).toBeInTheDocument();
    expect(props.setNewName).toHaveBeenCalledWith('Novo');
  });

  it('saves the new name', () => {
    const props = renameProps();
    render(<ProjectNameTitle {...props} isEditingName />);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar nome' }));

    expect(props.saveName).toHaveBeenCalled();
  });

  it('cancels editing and puts the old name back in the field', () => {
    const props = renameProps();
    render(<ProjectNameTitle {...props} isEditingName newName="Rascunho" />);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(props.setIsEditingName).toHaveBeenCalledWith(false);
    expect(props.setNewName).toHaveBeenCalledWith('Test Project');
  });
});

describe('ProjectNameActions', () => {
  it('starts renaming and asks to delete through named buttons', () => {
    const onRename = vi.fn();
    const onDelete = vi.fn();
    render(<ProjectNameActions onRename={onRename} onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('button', { name: 'Renomear projeto' }));
    fireEvent.click(screen.getByRole('button', { name: 'Excluir projeto' }));

    expect(onRename).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
