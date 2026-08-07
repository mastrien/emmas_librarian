import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectModalsContainer } from '../components/ProjectModalsContainer';
import { MemoryRouter } from 'react-router-dom';

// Mock all modals
vi.mock('../../../components/modals/ArchiveModal', () => ({
  ArchiveModal: ({ isOpen, onClose, onSubmit }: any) => isOpen ? <div data-testid="ArchiveModal"><button onClick={() => onSubmit('note')}>Submit Archive</button><button onClick={onClose}>Close Archive</button></div> : null
}));
vi.mock('../../../components/modals/ProjectCategoriesModal', () => ({
  ProjectCategoriesModal: ({ isOpen, onClose }: any) => isOpen ? <div data-testid="ProjectCategoriesModal"><button onClick={onClose}>Close Categories</button></div> : null
}));
vi.mock('../../../components/modals/EditArticleModal', () => ({
  EditArticleModal: ({ isOpen, onClose, onSubmit }: any) => isOpen ? <div data-testid="EditArticleModal"><button onClick={() => onSubmit({})}>Submit Edit</button><button onClick={onClose}>Close Edit</button></div> : null
}));
vi.mock('../../../components/modals/ManualArticleModal', () => ({
  ManualArticleModal: ({ isOpen, onClose, onSubmit }: any) => isOpen ? <div data-testid="ManualArticleModal"><button onClick={() => onSubmit({})}>Submit Manual</button><button onClick={onClose}>Close Manual</button></div> : null
}));
vi.mock('../../../components/modals/SearchHistoryModal', () => ({
  SearchHistoryModal: ({ isOpen, onClose, onRevertSearch }: any) => isOpen ? <div data-testid="SearchHistoryModal"><button onClick={() => onRevertSearch(1)}>Revert Search</button><button onClick={onClose}>Close History</button></div> : null
}));
vi.mock('../../../components/modals/AIExtractionModal', () => ({
  AIExtractionModal: ({ isOpen, onClose, handleMassiveExtraction }: any) => isOpen ? <div data-testid="AIExtractionModal"><button onClick={() => handleMassiveExtraction([1])}>Mass Extract</button><button onClick={onClose}>Close AI</button></div> : null
}));
vi.mock('../../../components/modals/ManageQuickAccessModal', () => ({
  ManageQuickAccessModal: ({ isOpen, onClose, onDocumentsChanged }: any) => isOpen ? <div data-testid="ManageQuickAccessModal"><button onClick={onDocumentsChanged}>Changed Docs</button><button onClick={onClose}>Close Quick Access</button></div> : null
}));
vi.mock('../../../components/modals/CitationModal', () => ({
  CitationModal: ({ isOpen, onClose, onArticleUpdated }: any) => isOpen ? <div data-testid="CitationModal"><button onClick={onArticleUpdated}>Updated Citation</button><button onClick={onClose}>Close Citation</button></div> : null
}));
vi.mock('../../../components/modals/MassCitationModal', () => ({
  MassCitationModal: ({ isOpen, onClose, onArticlesUpdated }: any) => isOpen ? <div data-testid="MassCitationModal"><button onClick={onArticlesUpdated}>Updated Mass</button><button onClick={onClose}>Close Mass</button></div> : null
}));
vi.mock('../../../components/modals/ArticleDetailsModal', () => ({
  ArticleDetailsModal: ({ isOpen, onClose, onNavigateToSearch, onArticleUpdated, onAttachPdf }: any) => isOpen ? <div data-testid="ArticleDetailsModal"><button onClick={() => onNavigateToSearch(1)}>Navigate Search</button><button onClick={onArticleUpdated}>Updated Article</button><button onClick={() => onAttachPdf({ id: 1 })}>Attach</button><button onClick={onClose}>Close Details</button></div> : null
}));
vi.mock('../../../components/modals/ImportArticlesModal', () => ({
  ImportArticlesModal: ({ isOpen, onClose, onImportComplete }: any) => isOpen ? <div data-testid="ImportArticlesModal"><button onClick={onImportComplete}>Import Complete</button><button onClick={onClose}>Close Import</button></div> : null
}));
vi.mock('../../../components/modals/AttachPdfModal', () => ({
  AttachPdfModal: ({ isOpen, onClose, onAttached }: any) => isOpen ? <div data-testid="AttachPdfModal"><button onClick={onAttached}>Attached</button><button onClick={onClose}>Close Attach Pdf</button></div> : null
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom') as any;
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ProjectModalsContainer', () => {
  const defaultModalsState = {
    archivingId: null,
    setArchivingId: vi.fn(),
    isCategoriesModalOpen: false,
    setIsCategoriesModalOpen: vi.fn(),
    editingArticle: null,
    setEditingArticle: vi.fn(),
    isManualModalOpen: false,
    setIsManualModalOpen: vi.fn(),
    isHistoryOpen: false,
    setIsHistoryOpen: vi.fn(),
    isAIExtractionModalOpen: false,
    setIsAIExtractionModalOpen: vi.fn(),
    showQuotaModal: false,
    setShowQuotaModal: vi.fn(),
    isQuickAccessModalOpen: false,
    setIsQuickAccessModalOpen: vi.fn(),
    citationArticle: null,
    setCitationArticle: vi.fn(),
    isMassCitationModalOpen: false,
    setIsMassCitationModalOpen: vi.fn(),
    selectedArticleForDetails: null,
    setSelectedArticleForDetails: vi.fn(),
    isImportArticlesModalOpen: false,
    setIsImportArticlesModalOpen: vi.fn(),
    attachPdfArticle: null,
    setAttachPdfArticle: vi.fn(),
  };

  const defaultProps = {
    projectId: 1,
    project: { id: 1 } as any,
    articles: [{ id: 1, title: 'Test Article' }] as any[],
    projectDocuments: [],
    history: [],
    readArticles: [],
    investigationHistory: [],
    modals: defaultModalsState,
    fetchData: vi.fn(),
    handleArchiveSubmit: vi.fn(),
    handleEditArticleSubmit: vi.fn(),
    handleManualArticleSubmit: vi.fn(),
    handleRevertSearch: vi.fn(),
    handleCloseAIExtractionModal: vi.fn(),
    handleMassiveExtraction: vi.fn(),
    aiQuestions: [],
    setAiQuestions: vi.fn(),
    isExtracting: false,
    extractionProgress: { current: 0, total: 0 },
    aiExtractionResults: [],
    cancelExtractionRef: { current: false },
    showKeyAlert: false,
    setShowKeyAlert: vi.fn(),
    setActiveTab: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ProjectModalsContainer {...defaultProps} {...props} />
      </MemoryRouter>
    );
  };

  it('renders nothing when all modals are closed', () => {
    renderComponent();
    expect(screen.queryByTestId('ArchiveModal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ProjectCategoriesModal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('EditArticleModal')).not.toBeInTheDocument();
    // ManualArticleModal and AIExtractionModal are rendered but their isOpen controls visibility via mock
    expect(screen.queryByTestId('ManualArticleModal')).not.toBeInTheDocument();
    expect(screen.queryByTestId('AIExtractionModal')).not.toBeInTheDocument();
  });

  it('renders and handles ArchiveModal', () => {
    renderComponent({ modals: { ...defaultModalsState, archivingId: 1 } });
    expect(screen.getByTestId('ArchiveModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Submit Archive'));
    expect(defaultProps.handleArchiveSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Archive'));
    expect(defaultModalsState.setArchivingId).toHaveBeenCalledWith(null);
  });

  it('renders and handles ProjectCategoriesModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isCategoriesModalOpen: true } });
    expect(screen.getByTestId('ProjectCategoriesModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close Categories'));
    expect(defaultModalsState.setIsCategoriesModalOpen).toHaveBeenCalledWith(false);
    expect(defaultProps.fetchData).toHaveBeenCalled();
  });

  it('renders and handles EditArticleModal', () => {
    renderComponent({ modals: { ...defaultModalsState, editingArticle: { id: 1 } } });
    expect(screen.getByTestId('EditArticleModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Submit Edit'));
    expect(defaultProps.handleEditArticleSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Edit'));
    expect(defaultModalsState.setEditingArticle).toHaveBeenCalledWith(null);
  });

  it('renders and handles ManualArticleModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isManualModalOpen: true } });
    expect(screen.getByTestId('ManualArticleModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Submit Manual'));
    expect(defaultProps.handleManualArticleSubmit).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Manual'));
    expect(defaultModalsState.setIsManualModalOpen).toHaveBeenCalledWith(false);
  });

  it('renders and handles SearchHistoryModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isHistoryOpen: true } });
    expect(screen.getByTestId('SearchHistoryModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Revert Search'));
    expect(defaultProps.handleRevertSearch).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close History'));
    expect(defaultModalsState.setIsHistoryOpen).toHaveBeenCalledWith(false);
  });

  it('renders and handles AIExtractionModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isAIExtractionModalOpen: true } });
    expect(screen.getByTestId('AIExtractionModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Mass Extract'));
    expect(defaultProps.handleMassiveExtraction).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close AI'));
    expect(defaultProps.handleCloseAIExtractionModal).toHaveBeenCalled();
  });

  it('renders and handles ManageQuickAccessModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isQuickAccessModalOpen: true } });
    expect(screen.getByTestId('ManageQuickAccessModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Changed Docs'));
    expect(defaultProps.fetchData).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Quick Access'));
    expect(defaultModalsState.setIsQuickAccessModalOpen).toHaveBeenCalledWith(false);
  });

  it('renders and handles CitationModal', () => {
    renderComponent({ modals: { ...defaultModalsState, citationArticle: { id: 1 } } });
    expect(screen.getByTestId('CitationModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Updated Citation'));
    expect(defaultProps.fetchData).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Citation'));
    expect(defaultModalsState.setCitationArticle).toHaveBeenCalledWith(null);
  });

  it('renders and handles MassCitationModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isMassCitationModalOpen: true } });
    expect(screen.getByTestId('MassCitationModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Updated Mass'));
    expect(defaultProps.fetchData).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Mass'));
    expect(defaultModalsState.setIsMassCitationModalOpen).toHaveBeenCalledWith(false);
  });

  it('renders and handles ArticleDetailsModal with finding article', () => {
    renderComponent({ modals: { ...defaultModalsState, selectedArticleForDetails: { id: 1 } } });
    expect(screen.getByTestId('ArticleDetailsModal')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Navigate Search'));
    expect(defaultModalsState.setSelectedArticleForDetails).toHaveBeenCalledWith(null);
    expect(defaultProps.setActiveTab).toHaveBeenCalledWith('history');

    fireEvent.click(screen.getByText('Updated Article'));
    expect(defaultProps.fetchData).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Attach'));
    expect(defaultModalsState.setAttachPdfArticle).toHaveBeenCalledWith({ id: 1 });

    fireEvent.click(screen.getByText('Close Details'));
    expect(defaultModalsState.setSelectedArticleForDetails).toHaveBeenCalledWith(null);
  });

  it('renders and handles ArticleDetailsModal without finding article in list', () => {
    renderComponent({ modals: { ...defaultModalsState, selectedArticleForDetails: { id: 999 } } });
    expect(screen.getByTestId('ArticleDetailsModal')).toBeInTheDocument();
  });

  it('renders and handles ImportArticlesModal', () => {
    renderComponent({ modals: { ...defaultModalsState, isImportArticlesModalOpen: true } });
    expect(screen.getByTestId('ImportArticlesModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Import Complete'));
    expect(defaultProps.fetchData).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Import'));
    expect(defaultModalsState.setIsImportArticlesModalOpen).toHaveBeenCalledWith(false);
  });

  it('renders and handles AttachPdfModal', () => {
    renderComponent({ modals: { ...defaultModalsState, attachPdfArticle: { id: 1, title: 'Title' } } });
    expect(screen.getByTestId('AttachPdfModal')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Attached'));
    expect(defaultProps.fetchData).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close Attach Pdf'));
    expect(defaultModalsState.setAttachPdfArticle).toHaveBeenCalledWith(null);
  });

  it('renders Quota Modal portal', () => {
    renderComponent({ modals: { ...defaultModalsState, showQuotaModal: true } });
    expect(screen.getByText('Limite de Cota Atingido')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Entendi'));
    expect(defaultModalsState.setShowQuotaModal).toHaveBeenCalledWith(false);
  });

  it('renders Key Alert Modal portal', () => {
    renderComponent({ showKeyAlert: true });
    expect(screen.getByText('Chave de IA Necessária')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancelar'));
    expect(defaultProps.setShowKeyAlert).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByText('Configurações'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings');
  });
});
