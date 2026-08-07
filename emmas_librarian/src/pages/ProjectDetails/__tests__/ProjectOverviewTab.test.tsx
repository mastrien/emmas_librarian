import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProjectOverviewTab } from '../components/ProjectOverviewTab';

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Pie: ({ data }: any) => (
    <div data-testid="pie-chart">
      {data.labels.join(', ')}
      {data.datasets.map((ds: any, i: number) => (
        <span key={i}>{ds.data.join(', ')}</span>
      ))}
    </div>
  ),
  Bar: ({ data }: any) => (
    <div data-testid="bar-chart">
      {data.labels.join(', ')}
      {data.datasets.map((ds: any, i: number) => (
        <span key={i}>{ds.data.join(', ')}</span>
      ))}
    </div>
  )
}));

describe('ProjectOverviewTab', () => {
  const activeArticles: any[] = [
    { id: 1, year: 2021, is_oa: 1, source_databases: 'Scopus', publisher: 'Elsevier', doi: '10.123/1' },
    { id: 2, year: 2022, is_oa: 0, source_databases: '["PubMed"]', publisher: 'Springer', doi: '10.123/2' }
  ];
  
  const readArticles: any[] = [
    { id: 3, year: 2021, is_oa: 1, source_databases: '["Scopus","PubMed"]', publisher: 'Elsevier', doi: '' }
  ];
  
  const archivedArticles: any[] = [
    { id: 4, year: null, is_oa: null, source_databases: null, publisher: null, doi: null }
  ];

  const filteredArticles = [...activeArticles, ...readArticles, ...archivedArticles];

  const defaultProps = {
    activeArticles,
    readArticles,
    archivedArticles,
    filteredArticles
  };

  it('renders overview tab with all charts', () => {
    render(<ProjectOverviewTab {...defaultProps} />);
    
    expect(screen.getByText('Status dos Artigos')).toBeInTheDocument();
    expect(screen.getByText('Artigos por Ano')).toBeInTheDocument();
    expect(screen.getByText('Acesso Aberto (Open Access)')).toBeInTheDocument();
    expect(screen.getByText('Artigos por Base de Dados')).toBeInTheDocument();
    expect(screen.getByText('Top 10 Editoras / Publishers')).toBeInTheDocument();
    expect(screen.getByText('Completude de DOI')).toBeInTheDocument();

    // Check Status data
    expect(screen.getByText(/Ativos \(/)).toHaveTextContent('Ativos (2)');
    expect(screen.getByText(/Lidos \(/)).toHaveTextContent('Lidos (1)');
    expect(screen.getByText(/Arquivados \(/)).toHaveTextContent('Arquivados (1)');

    const pies = screen.getAllByTestId('pie-chart');
    expect(pies).toHaveLength(4); // Status, OA, Base, DOI

    const bars = screen.getAllByTestId('bar-chart');
    expect(bars).toHaveLength(2); // Ano, Editoras
  });

  it('aggregates data correctly for Artigos por Ano', () => {
    render(<ProjectOverviewTab {...defaultProps} />);
    const bars = screen.getAllByTestId('bar-chart');
    const anoChart = bars[0];
    
    // Years: 2021 (2), 2022 (1), N/A (1)
    expect(anoChart).toHaveTextContent('2021, 2022, N/A');
    expect(anoChart).toHaveTextContent('2, 1, 1');
  });

  it('aggregates data correctly for Acesso Aberto', () => {
    render(<ProjectOverviewTab {...defaultProps} />);
    const pies = screen.getAllByTestId('pie-chart');
    const oaChart = pies[1];
    
    // OA: 2, Closed: 2
    expect(oaChart).toHaveTextContent('Open Access, Closed / Não especificado');
    expect(oaChart).toHaveTextContent('2, 2');
  });

  it('aggregates data correctly for Artigos por Base de Dados', () => {
    render(<ProjectOverviewTab {...defaultProps} />);
    const pies = screen.getAllByTestId('pie-chart');
    const baseChart = pies[2];
    
    // DBs: Scopus (2), PubMed (1), Desconhecido (1)
    expect(baseChart).toHaveTextContent('Scopus, PubMed, Desconhecido');
    expect(baseChart).toHaveTextContent('2, 1, 1');
  });

  it('aggregates data correctly for Top 10 Editoras', () => {
    render(<ProjectOverviewTab {...defaultProps} />);
    const bars = screen.getAllByTestId('bar-chart');
    const editoraChart = bars[1];
    
    // Publishers: Elsevier (2), Springer (1), Desconhecido (1)
    expect(editoraChart).toHaveTextContent('Elsevier, Springer, Desconhecido');
    expect(editoraChart).toHaveTextContent('2, 1, 1');
  });

  it('aggregates data correctly for Completude de DOI', () => {
    render(<ProjectOverviewTab {...defaultProps} />);
    const pies = screen.getAllByTestId('pie-chart');
    const doiChart = pies[3];
    
    // DOI: 2, Sem: 2
    expect(doiChart).toHaveTextContent('Com DOI, Sem DOI');
    expect(doiChart).toHaveTextContent('2, 2');
  });

  it('handles empty articles gracefully', () => {
    render(<ProjectOverviewTab activeArticles={[]} readArticles={[]} archivedArticles={[]} filteredArticles={[]} />);
    const pies = screen.getAllByTestId('pie-chart');
    
    expect(pies[0]).toHaveTextContent('Ativos, Lidos, Arquivados');
    expect(pies[0]).toHaveTextContent('0, 0, 0');
  });
});
