import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProjectAboutEditor } from '../ProjectAboutEditor';
import { ABOUT_AUTOSAVE_DELAY_MS } from '../useProjectAbout';
import { ServicesProvider } from '../../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../../services/__tests__/fakes/FakeProjectService';

vi.mock(
  '@mdxeditor/editor',
  async () => (await import('../../../../../components/__tests__/fakes/FakeMdxEditor')).fakeMdxEditorModule,
);
vi.mock('@mdxeditor/editor/style.css', () => ({}));

afterEach(() => vi.useRealTimers());

function renderEditor() {
  const service = FakeProjectService.create();
  service.aboutByProject.set(3, '## Objetivo');
  render(
    <ServicesProvider apiService={service}>
      <ProjectAboutEditor projectId={3} />
    </ServicesProvider>,
  );
  return service;
}

describe('ProjectAboutEditor', () => {
  it('opens the stored page under "Sobre o projeto"', async () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: 'Sobre o projeto' })).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: 'editor' })).toHaveValue('## Objetivo');
  });

  it('saves what was typed and says it is saved', async () => {
    const service = renderEditor();
    const editor = await screen.findByRole('textbox', { name: 'editor' });
    vi.useFakeTimers();

    fireEvent.change(editor, { target: { value: '## Objetivo\n\nPrever a chuva.' } });
    await act(async () => vi.advanceTimersByTime(ABOUT_AUTOSAVE_DELAY_MS));

    expect(service.updateProjectAbout).toHaveBeenCalledWith(3, '## Objetivo\n\nPrever a chuva.');
    expect(screen.getByRole('status')).toHaveTextContent('Salvo');
  });

  it('opens the other project with its own text, and saves what was typed in the first one under the first', async () => {
    const service = FakeProjectService.create();
    service.aboutByProject.set(3, 'texto do três');
    service.aboutByProject.set(4, 'texto do quatro');
    const tree = (id: number) => (
      <ServicesProvider apiService={service}>
        <ProjectAboutEditor projectId={id} />
      </ServicesProvider>
    );
    const { rerender } = render(tree(3));
    fireEvent.change(await screen.findByRole('textbox', { name: 'editor' }), { target: { value: 'editado no três' } });

    rerender(tree(4));

    expect(await screen.findByDisplayValue('texto do quatro')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('editado no três')).not.toBeInTheDocument();
    expect(service.updateProjectAbout).toHaveBeenCalledWith(3, 'editado no três');
    expect(service.updateProjectAbout).not.toHaveBeenCalledWith(4, expect.anything());
  });
});
