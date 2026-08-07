import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectSidebar } from '../components/ProjectSidebar';

describe('ProjectSidebar', () => {
  const defaultProps = {
    statusFilter: 'all' as any,
    setStatusFilter: vi.fn(),
    uniqueDatabases: [],
    selectedDatabases: [],
    setSelectedDatabases: vi.fn(),
    uniqueDocTypes: [],
    selectedDocType: '',
    setSelectedDocType: vi.fn(),
    keywordFrequencies: [],
    selectedKeyword: '',
    setSelectedKeyword: vi.fn(),
    setCurrentPage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(<ProjectSidebar {...defaultProps} {...props} />);
  };

  it('renders status filters', () => {
    renderComponent();
    expect(screen.getByText('STATUS')).toBeInTheDocument();
    expect(screen.getByText('Não Lidos')).toBeInTheDocument();
    expect(screen.getByText('Lidos')).toBeInTheDocument();
    expect(screen.getByText('Arquivados')).toBeInTheDocument();
    expect(screen.getByText('Todos')).toBeInTheDocument();
  });

  it('handles status filter change', () => {
    renderComponent();
    const radio = screen.getByLabelText('Não Lidos');
    act(() => {
      fireEvent.click(radio);
    });
    expect(defaultProps.setStatusFilter).toHaveBeenCalledWith('new');
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('renders and handles database filters', () => {
    renderComponent({
      uniqueDatabases: ['Scopus', 'PubMed'],
      selectedDatabases: ['Scopus']
    });
    
    expect(screen.getByText('BASES DE DADOS')).toBeInTheDocument();
    
    const scopusCheck = screen.getByLabelText('Scopus') as HTMLInputElement;
    expect(scopusCheck.checked).toBe(true);
    
    const pubmedCheck = screen.getByLabelText('PubMed') as HTMLInputElement;
    expect(pubmedCheck.checked).toBe(false);

    // Uncheck Scopus
    act(() => {
      fireEvent.click(scopusCheck);
    });
    expect(defaultProps.setSelectedDatabases).toHaveBeenCalledWith([]);
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);

    // Check PubMed
    act(() => {
      fireEvent.click(pubmedCheck);
    });
    expect(defaultProps.setSelectedDatabases).toHaveBeenCalledWith(['Scopus', 'PubMed']);
  });

  it('renders and handles document types', () => {
    renderComponent({
      uniqueDocTypes: ['Article', 'Review'],
      selectedDocType: 'Article'
    });
    
    expect(screen.getByText('TIPO DE DOCUMENTO')).toBeInTheDocument();
    
    const select = screen.getByDisplayValue('Article');
    act(() => {
      fireEvent.change(select, { target: { value: 'Review' } });
    });
    
    expect(defaultProps.setSelectedDocType).toHaveBeenCalledWith('Review');
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);
  });

  it('renders and handles keyword tags', () => {
    renderComponent({
      keywordFrequencies: [{ keyword: 'AI', count: 5 }, { keyword: 'ML', count: 3 }],
      selectedKeyword: 'AI'
    });
    
    expect(screen.getByText('NUVEM DE PALAVRAS-CHAVE')).toBeInTheDocument();
    expect(screen.getByText('AI')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('ML')).toBeInTheDocument();
    expect(screen.getByText('(3)')).toBeInTheDocument();

    // Click active keyword to deselect
    const aiBtn = screen.getByText('AI').closest('button')!;
    act(() => {
      fireEvent.click(aiBtn);
    });
    expect(defaultProps.setSelectedKeyword).toHaveBeenCalledWith('');
    expect(defaultProps.setCurrentPage).toHaveBeenCalledWith(1);

    // Click inactive keyword to select
    const mlBtn = screen.getByText('ML').closest('button')!;
    act(() => {
      fireEvent.click(mlBtn);
    });
    expect(defaultProps.setSelectedKeyword).toHaveBeenCalledWith('ML');
  });
});
