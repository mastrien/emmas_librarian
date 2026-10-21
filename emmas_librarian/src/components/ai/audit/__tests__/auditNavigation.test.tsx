import React from 'react';
import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AIExtractionModal, type AIExtractionModalProps } from '../../../modals/AIExtractionModal';
import { InvestigationDetailView } from '../../InvestigationDetailView';
import { ArticleReaderToolbar } from '../../../../pages/ArticleReader/components/ArticleReaderToolbar';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService } from '../../../../services/__tests__/fakes/FakeProjectService';
import type { Article, InvestigationAudit, InvestigationResult } from '../../../../types';

const article = { id: 1, project_id: 3, title: 'Estudo 1', status: 'read' } as Article;
const answer: InvestigationResult = {
  id: 42,
  investigation_id: 19,
  article_id: 1,
  question: 'Q1',
  answer: 'Coorte',
  quote: 'trecho',
  status: 'success',
  error_message: null,
  created_at: '',
  review_status: 'accepted',
  reviewed_answer: null,
  reviewed_at: null,
};
const audit: InvestigationAudit = {
  id: 1,
  investigation_id: 19,
  seed: 7,
  sample_percent: 100,
  min_per_question: 1,
  created_at: '',
};
const investigation = { id: 19, created_at: '', model_used: 'gpt-x', questions: '["Q1"]', articles_ids: '[1]' };
const back = { projectId: 3, investigationId: 19, resultId: 42 };

const Probe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}|${JSON.stringify(location.state)}`}</div>;
};

describe('the audit from the investigation screen (#48)', () => {
  function renderDetail(service: FakeProjectService, extra: { initialAuditResultId?: number } = {}) {
    render(
      <MemoryRouter>
        <ServicesProvider apiService={service}>
          <InvestigationDetailView
            investigation={investigation}
            articles={[article]}
            getInvestigationResults={async () => [answer]}
            onBack={vi.fn()}
            onReExecute={vi.fn()}
            projectId={3}
            history={[investigation]}
            {...extra}
          />
        </ServicesProvider>
      </MemoryRouter>,
    );
  }

  it('opens the audit with "Auditar" and goes back to the results', async () => {
    renderDetail(new FakeProjectService());

    fireEvent.click(await screen.findByRole('button', { name: 'Auditar' }));
    expect(await screen.findByText('Auditoria da investigação #19')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '← Voltar à investigação' }));

    expect(await screen.findByRole('button', { name: 'Auditar' })).toBeInTheDocument();
  });

  it('puts the audit in the CSV export when there is one', async () => {
    const service = new FakeProjectService();
    service.getInvestigationAudit.mockResolvedValue(audit);
    service.saveExportedFile.mockResolvedValue(true);
    renderDetail(service);

    const exportButton = await screen.findByRole('button', { name: 'Exportar CSV' });
    await act(async () => {
      fireEvent.click(exportButton);
    });

    const [csv] = service.saveExportedFile.mock.calls[0];
    expect(csv.split(/\r?\n/)[0]).toContain('Na amostra da auditoria');
    expect(csv.split(/\r?\n/)[1].endsWith(',sim')).toBe(true);
  });

  it('opens straight on the audit when coming back from the reader', async () => {
    const service = new FakeProjectService();
    service.getInvestigationAudit.mockResolvedValue(audit);
    renderDetail(service, { initialAuditResultId: 42 });

    expect(await screen.findByRole('complementary', { name: 'Evidência do item selecionado' })).toHaveTextContent(
      'Coorte',
    );
  });
});

describe('back from the reader to the audit', () => {
  function renderToolbar(state: unknown) {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/articles/1', state }]}>
        <Routes>
          <Route
            path="/articles/1"
            element={
              <ArticleReaderToolbar
                article={article}
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
          <Route path="/projects/3" element={<Probe />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('goes back to the project asking it to reopen the audit on the same item', () => {
    renderToolbar({ searchQuery: 'trecho', returnTo: back });

    fireEvent.click(screen.getByRole('link', { name: 'Voltar para a auditoria' }));

    expect(screen.getByTestId('where')).toHaveTextContent(`/projects/3|${JSON.stringify({ openAudit: back })}`);
  });

  it('is the plain way back to the project otherwise', () => {
    renderToolbar(null);

    fireEvent.click(screen.getByRole('link', { name: 'Voltar ao projeto' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/projects/3|null');
  });
});

describe('the AI window reopening an audit', () => {
  it('opens the history on the audited investigation, at the item', async () => {
    const service = new FakeProjectService();
    service.getQuestionSets.mockReturnValue(new Promise(() => undefined));
    service.getInvestigationAudit.mockResolvedValue(audit);
    const props: AIExtractionModalProps = {
      isOpen: true,
      onClose: vi.fn(),
      articlesWithPdf: [article],
      articles: [article],
      aiQuestions: ['Q1'],
      setAiQuestions: vi.fn(),
      handleMassiveExtraction: vi.fn(),
      isExtracting: false,
      extractionProgress: { current: 0, total: 0 },
      aiExtractionResults: [],
      cancelExtractionRef: { current: false },
      investigationHistory: [investigation],
      getInvestigationResults: vi.fn().mockResolvedValue([answer]),
      projectId: 3,
      reopenAudit: back,
    };
    render(
      <ServicesProvider apiService={service}>
        <MemoryRouter>
          <AIExtractionModal {...props} />
        </MemoryRouter>
      </ServicesProvider>,
    );

    expect(await screen.findByText('Auditoria da investigação #19')).toBeInTheDocument();
    expect(await screen.findByRole('complementary', { name: 'Evidência do item selecionado' })).toHaveTextContent(
      'Coorte',
    );
  });
});
