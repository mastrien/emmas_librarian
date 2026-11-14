import { act } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { ArticleReaderToolbar } from '../../../../pages/ArticleReader/components/ArticleReaderToolbar';
import {
  answer,
  article,
  investigationService,
  record,
  renderInvestigation,
  setWindowWidth,
} from '../../../../pages/Investigation/__tests__/investigationTestData';
import type { InvestigationAudit } from '../../../../types';

const study = article(1);
const result = answer(1, 'Q1', {
  id: 42,
  investigation_id: 19,
  answer: 'Coorte',
  quote: 'trecho',
  review_status: 'accepted',
});
const audit = {
  id: 1,
  investigation_id: 19,
  seed: 1,
  sample_percent: 100,
  min_per_question: 1,
  created_at: '',
} as InvestigationAudit;
const back = { projectId: 3, investigationId: 19, resultId: 42 };

const audited = () => {
  const service = investigationService([study], [record(19, { questions: JSON.stringify(['Q1']) })], { 19: [result] });
  service.getInvestigationAudit.mockResolvedValue(audit);
  service.getInvestigationAuditsByProject.mockResolvedValue([audit]);
  return service;
};

beforeEach(() => {
  sessionStorage.clear();
  setWindowWidth(1600);
});

describe('the audit on the investigation page', () => {
  it('is a tab of the investigation', async () => {
    renderInvestigation(audited(), '/projects/3/investigation/19');

    fireEvent.click(await screen.findByRole('tab', { name: 'Auditoria' }));

    expect(await screen.findByRole('navigation', { name: 'Amostra' })).toBeInTheDocument();
  });

  it('puts the audit in the CSV export when there is one', async () => {
    const service = audited();
    service.saveExportedFile.mockResolvedValue(true);
    renderInvestigation(service, '/projects/3/investigation/19');

    // Since board 162 the formats are in the header's "Exportar" menu, shown once there are answers.
    fireEvent.click(await screen.findByRole('button', { name: /^Exportar/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    });

    const [csv] = service.saveExportedFile.mock.calls[0];
    expect(csv.split(/\r?\n/)[0]).toContain('Na amostra da auditoria');
    expect(csv.split(/\r?\n/)[1].endsWith(',sim')).toBe(true);
  });

  it('opens straight on the audit, at the item, when coming back from the reader', async () => {
    renderInvestigation(audited(), { pathname: '/projects/3/investigation/19', state: { openAudit: back } });

    expect(await screen.findByRole('complementary', { name: 'Evidência do item selecionado' })).toHaveTextContent(
      'Coorte',
    );
    expect(screen.getByRole('tab', { name: 'Auditoria' })).toHaveAttribute('aria-selected', 'true');
  });

  it('shows the item as a drawer on a narrow window, closed by its X', async () => {
    setWindowWidth(1000);
    renderInvestigation(audited(), { pathname: '/projects/3/investigation/19', state: { openAudit: back } });

    const drawer = await screen.findByRole('dialog', { name: 'Item da amostra' });
    expect(within(drawer).getByRole('complementary', { name: 'Evidência do item selecionado' })).toHaveTextContent(
      'Coorte',
    );
    fireEvent.click(within(drawer).getByRole('button', { name: 'Fechar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Amostra' })).toBeInTheDocument();
  });
});

const Probe = () => {
  const location = useLocation();
  return <output data-testid="where">{`${location.pathname}|${JSON.stringify(location.state)}`}</output>;
};

describe('back from the reader to the audit', () => {
  function renderToolbar(state: unknown) {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/articles/1', state }]}>
        <Routes>
          <Route
            path="/articles/1"
            element={
              <ArticleReaderToolbar
                article={study}
                hasLocalFile
                uploading={false}
                scale={1}
                handleZoom={vi.fn()}
                handleFileUpload={vi.fn()}
                handleUnlinkClick={vi.fn()}
                setIsEditingMetadata={vi.fn()}
                setIsCitationModalOpen={vi.fn()}
              />
            }
          />
          <Route path="/projects/*" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('goes back to the investigation asking it to reopen the audit on the same item', () => {
    renderToolbar({ searchQuery: 'trecho', returnTo: back });

    fireEvent.click(screen.getByRole('link', { name: 'Voltar para a auditoria' }));

    expect(screen.getByTestId('where')).toHaveTextContent(
      `/projects/3/investigation/19|${JSON.stringify({ openAudit: back })}`,
    );
  });

  it('follows the way back an answer of the investigation left', () => {
    renderToolbar({ backTo: { path: '/projects/3/investigation/19', label: 'Voltar à investigação' } });

    fireEvent.click(screen.getByRole('link', { name: 'Voltar à investigação' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/projects/3/investigation/19|null');
  });

  it('is the plain way back to the project otherwise', () => {
    renderToolbar(null);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao projeto' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/projects/3|null');
  });
});
