import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  CopyPlus,
  FileText,
  PieChart as PieChartIcon,
  BookOpen,
  Tags,
  History,
  Search,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useProjectService } from '../contexts/ServicesContext';
import { useGlobalError } from '../contexts/GlobalErrorContext';
import { Project, Article, ProjectDocument } from '../types';

import { useProjectFiltering } from './ProjectDetails/hooks/useProjectFiltering';
import { useProjectModals } from './ProjectDetails/hooks/useProjectModals';
import { ProjectHeader } from './ProjectDetails/components/ProjectHeader';
import { ProjectToolbar } from './ProjectDetails/components/ProjectToolbar';
import { ProjectArticlesList } from './ProjectDetails/components/ProjectArticlesList';
import { ProjectModalsContainer } from './ProjectDetails/components/ProjectModalsContainer';

import { ProjectOverviewTab } from './ProjectDetails/components/ProjectOverviewTab';
import { ProjectSidebar } from './ProjectDetails/components/ProjectSidebar';
import { ProjectCategoriesTab } from './ProjectDetails/components/ProjectCategoriesTab';
import { DiarySection } from '../components/common/DiarySection';
import { SearchHistoryModal } from '../components/modals/SearchHistoryModal';

const ITEMS_PER_PAGE = 50;

const isArticleManual = (article: Article) => {
  try {
    return JSON.parse(article.source_databases as string).includes('Manual');
  } catch {
    return false;
  }
};

export const ProjectDetailsPage: React.FC = () => {
  const projectService = useProjectService();
  const { id } = useParams<{ id: string }>();
  const { showError } = useGlobalError();
  const navigate = useNavigate();

  // Basic state
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [projectDocuments, setProjectDocuments] = useState<ProjectDocument[]>([]);
  const [investigationHistory, setInvestigationHistory] = useState<any[]>([]);
  const [projectCategories, setProjectCategories] = useState<any[]>([]);
  const [articleCategories, setArticleCategories] = useState<any[]>([]);

  // Page specific states
  const [activeTab, setActiveTab] = useState<string>('articles');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  
  const [isImportingPdfs, setIsImportingPdfs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  
  const [hasAiKey, setHasAiKey] = useState(false);
  const [showKeyAlert, setShowKeyAlert] = useState(false);

  // Extraction states
  const [aiQuestions, setAiQuestions] = useState<string[]>(['']);
  const [aiExtractionResults, setAiExtractionResults] = useState<any[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const cancelExtractionRef = useRef(false);

  // Layout states for toolbar
  const [isAddArticlesMenuOpen, setIsAddArticlesMenuOpen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const addArticlesMenuRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const addMenuLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const exportMenuLeaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Modals hook
  const modals = useProjectModals();
  
  // Filtering hook
  const {
    searchTerm, setSearchTerm,
    onlyWithPdf, setOnlyWithPdf,
    onlyOpenAccess, setOnlyOpenAccess,
    statusFilter, setStatusFilter,
    selectedDatabases, setSelectedDatabases,
    selectedDocType, setSelectedDocType,
    selectedKeyword, setSelectedKeyword,
    sortOrder, setSortOrder,
    currentPage, setCurrentPage,
    
    uniqueDatabases,
    uniqueDocTypes,
    keywordFrequencies,
    
    activeArticles,
    readArticles,
    archivedArticles,
    filteredArticles,
    
    totalPages,
    paginatedArticles,
    
    isReadArticlesOpen, setIsReadArticlesOpen,
    isArchivedArticlesOpen, setIsArchivedArticlesOpen,
  } = useProjectFiltering(articles, ITEMS_PER_PAGE);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [
        projData,
        artData,
        histData,
        openai,
        gemini,
        anthropic,
        ollama,
        docsData,
        invHist,
        projCategories,
        artCategories,
      ] = await Promise.all([
        projectService.getProject(parseInt(id)),
        projectService.getArticles(parseInt(id)),
        projectService.getSearchHistory(parseInt(id)),
        projectService.getSetting('api_key_openai'),
        projectService.getSetting('api_key_gemini'),
        projectService.getSetting('api_key_anthropic'),
        projectService.getSetting('api_key_ollama'),
        projectService.getProjectDocuments(parseInt(id)),
        projectService.getMassiveInvestigations(parseInt(id)),
        projectService.getProjectCategories(parseInt(id)),
        projectService.getAllProjectArticleCategories(parseInt(id)),
      ]);
      setProject(projData);
      setArticles(artData);
      modals.setSelectedArticleForDetails((prev) => {
        if (!prev) return null;
        return artData.find((a: Article) => a.id === prev.id) || prev;
      });
      setHistory(histData);
      setHasAiKey(!!(openai || gemini || anthropic || ollama));
      setNewName(projData.name);
      setProjectDocuments(docsData);
      setInvestigationHistory(invHist);
      setProjectCategories(projCategories);
      setArticleCategories(artCategories);
    } catch (err) {
      console.error('Erro ao carregar dados do projeto', err);
    } finally {
      setLoading(false);
    }
  }, [id, modals]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Menu mouse events
  const handleAddMenuMouseEnter = () => {
    if (addMenuLeaveTimeoutRef.current) clearTimeout(addMenuLeaveTimeoutRef.current);
    setIsAddArticlesMenuOpen(true);
  };
  const handleAddMenuMouseLeave = () => {
    addMenuLeaveTimeoutRef.current = setTimeout(() => {
      setIsAddArticlesMenuOpen(false);
    }, 200);
  };
  const handleExportMenuMouseEnter = () => {
    if (exportMenuLeaveTimeoutRef.current) clearTimeout(exportMenuLeaveTimeoutRef.current);
    setIsExportMenuOpen(true);
  };
  const handleExportMenuMouseLeave = () => {
    exportMenuLeaveTimeoutRef.current = setTimeout(() => {
      setIsExportMenuOpen(false);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addArticlesMenuRef.current && !addArticlesMenuRef.current.contains(event.target as Node)) {
        setIsAddArticlesMenuOpen(false);
      }
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCloseAIExtractionModal = () => {
    modals.setIsAIExtractionModalOpen(false);
    setAiQuestions(['']);
    setAiExtractionResults([]);
    setExtractionProgress({ current: 0, total: 0 });
    setIsExtracting(false);
  };

  const handleUploadClick = useCallback(
    (articleId: number) => {
      const art = articles.find((a) => a.id === articleId);
      if (art) {
        modals.setAttachPdfArticle({ id: art.id, title: art.title });
      }
    },
    [articles, modals],
  );

  const handleUnlinkClick = useCallback(
    async (articleId: number) => {
      if (
        window.confirm(
          'Deseja realmente desvincular o PDF deste artigo? O arquivo físico será removido do armazenamento local.',
        )
      ) {
        try {
          await projectService.unlinkPdf(articleId);
          await fetchData();
        } catch (err) {
          alert('Erro ao desvincular o PDF');
        }
      }
    },
    [fetchData, projectService],
  );

  const handleRevertSearch = async (searchId: number) => {
    try {
      await projectService.revertSearch(searchId);
      await fetchData();
    } catch (err) {
      alert('Erro ao desfazer a busca');
    }
  };

  const handleStatusChange = useCallback(
    async (articleId: number, status: 'new' | 'read' | 'archived', note?: string) => {
      try {
        await projectService.updateArticleStatus(articleId, status, note);
        setArticles((prev) => prev.map((a) => (a.id === articleId ? { ...a, status, archive_note: note } : a)));
      } catch (e: any) {
        alert(`Erro ao atualizar status do artigo: ${e.message}`);
      }
    },
    [projectService],
  );

  const handleUpdateName = async () => {
    if (!id || !newName.trim()) return;
    try {
      await projectService.updateProject(parseInt(id), newName.trim());
      setProject((prev) => (prev ? { ...prev, name: newName.trim() } : null));
      setIsEditingName(false);
    } catch (e) {
      alert('Erro ao atualizar nome do projeto');
    }
  };

  const handleDeleteProject = async () => {
    if (!id || !project) return;
    if (
      window.confirm(
        `Tem certeza que deseja excluir o projeto "${project.name}"? Todos os artigos e anotações serão perdidos permanentemente.`,
      )
    ) {
      try {
        await projectService.deleteProject(parseInt(id));
        navigate('/');
      } catch (e) {
        alert('Erro ao excluir projeto');
      }
    }
  };

  const handleArchiveSubmit = (note: string) => {
    if (modals.archivingId) {
      handleStatusChange(modals.archivingId, 'archived', note);
      modals.setArchivingId(null);
    }
  };

  const handleManualArticleSubmit = async (data: any, filePath?: string) => {
    if (!id) return;
    await projectService.createManualArticle(parseInt(id), data, filePath);
    await fetchData();
  };

  const handleEditArticleSubmit = async (data: any) => {
    if (!modals.editingArticle) return;
    await projectService.updateArticleMetadata(modals.editingArticle.id, data);
    await fetchData();
  };

  const handleBatchPdfImport = async () => {
    if (!id) return;
    try {
      setIsImportingPdfs(true);
      const filePaths = await projectService.openMultiplePdfsDialog();
      if (filePaths && filePaths.length > 0) {
        const count = await projectService.createArticlesFromPdfs(parseInt(id), filePaths);
        alert(`${count} artigo(s) importado(s) com sucesso.`);
        await fetchData();
      }
    } catch (err: any) {
      alert(`Erro ao importar PDFs: ${err.message || err}`);
    } finally {
      setIsImportingPdfs(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (modals.isQuickAccessModalOpen) return;
    const types = Array.from(e.dataTransfer?.types || []);
    const isFileDrag = types.length === 0 || types.includes('Files');
    if (isFileDrag) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (!id) return;

    const files = Array.from(e.dataTransfer.files);
    const pdfFiles = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length > 0) {
      try {
        setIsImportingPdfs(true);
        // @ts-ignore
        const filePaths = pdfFiles.map((f) =>
          window.electronAPI && window.electronAPI.getPathForFile
            ? window.electronAPI.getPathForFile(f)
            : (f as any).path || f.name,
        );
        const count = await projectService.createArticlesFromPdfs(parseInt(id), filePaths);
        alert(`${count} artigo(s) importado(s) com sucesso.`);
        await fetchData();
      } catch (err: any) {
        alert(`Erro ao importar PDFs: ${err.message || err}`);
      } finally {
        setIsImportingPdfs(false);
      }
    }
  };

  const getModelUsedDescription = async (): Promise<string> => {
    try {
      const configs = await projectService.getAiModelConfigs();
      const extractionConfig = configs.find((c) => c.skill === 'extraction');
      if (!extractionConfig) return 'Desconhecido';
      const providerMap: Record<string, string> = {
        openai: 'OpenAI',
        gemini: 'Gemini',
        anthropic: 'Anthropic',
        ollama: 'Ollama',
      };
      const providerName = providerMap[extractionConfig.provider] || extractionConfig.provider;
      return extractionConfig.model_name ? `${providerName} (${extractionConfig.model_name})` : providerName;
    } catch {
      return 'Desconhecido';
    }
  };

  const saveArticleResult = async (invId: number, articleId: number, res: any, questions: string[]): Promise<void> => {
    const mapped = res.result
      ? res.result.map((r: any) => ({
          question: r.question,
          answer: JSON.stringify(r),
          quote: null,
          status: 'success' as const,
          error_message: null,
        }))
      : questions.map((q) => ({
          question: q,
          answer: null,
          quote: null,
          status: 'error' as const,
          error_message: res.error || 'Falha desconhecida',
        }));
    await projectService.saveInvestigationResults(invId, articleId, mapped);
  };

  const saveSkippedArticleResults = async (invId: number, articleId: number, questions: string[]): Promise<void> => {
    const mapped = questions.map((q) => ({
      question: q,
      answer: null,
      quote: null,
      status: 'skipped' as const,
      error_message: 'Cancelado ou não executado.',
    }));
    await projectService.saveInvestigationResults(invId, articleId, mapped);
  };

  const handleMassiveExtraction = async (selectedIds: number[]) => {
    const validQuestions = aiQuestions.filter((q) => q.trim().length > 0);
    if (validQuestions.length === 0) return;

    const articlesToExtract = articles.filter((a) => selectedIds.includes(a.id));
    if (articlesToExtract.length === 0) return;

    setIsExtracting(true);
    cancelExtractionRef.current = false;
    setExtractionProgress({ current: 0, total: articlesToExtract.length });
    setAiExtractionResults([]);

    try {
      const results = [];
      let finalStatus = 'Sucesso';
      for (let i = 0; i < articlesToExtract.length; i++) {
        if (cancelExtractionRef.current) break;

        const article = articlesToExtract[i];
        setExtractionProgress({ current: i + 1, total: articlesToExtract.length });
        try {
          const result = await projectService.massiveExtraction(article.id, validQuestions);
          results.push({ article, result });
          setAiExtractionResults([...results]);
        } catch (err: any) {
          console.error(`Erro ao extrair de ${article.title}:`, err);

          if (err.message && (err.message.includes('429') || err.message.includes('QUOTA_EXCEEDED'))) {
            modals.setShowQuotaModal(true);
            cancelExtractionRef.current = true;
            finalStatus = 'Erro: Quota Excedida';
            break;
          }

          cancelExtractionRef.current = true;
          setIsExtracting(false);
          showError(err);
          return;
        }
      }

      if (id && results.length > 0) {
        const modelUsed = await getModelUsedDescription();

        const invId = await projectService.saveMassiveInvestigation(
          parseInt(id),
          validQuestions,
          selectedIds,
          modelUsed,
          finalStatus,
        );

        for (const res of results) {
          await saveArticleResult(invId, res.article.id, res, validQuestions);
        }

        const processedIds = results.map((r) => r.article.id);
        const skipped = articlesToExtract.filter((a) => !processedIds.includes(a.id));
        for (const art of skipped) {
          await saveSkippedArticleResults(invId, art.id, validQuestions);
        }

        // refetch history
        const newHist = await projectService.getMassiveInvestigations(parseInt(id));
        setInvestigationHistory(newHist);
      }
    } catch (globalErr) {
      showError(globalErr);
    } finally {
      setIsExtracting(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Carregando...</div>;
  if (!project) return <div style={{ padding: '2rem', textAlign: 'center' }}>Projeto não encontrado.</div>;

  const tabs: { id: string; label: string; icon: React.ReactNode }[] = [
    { id: 'articles', label: `Artigos (${articles.length})`, icon: <FileText size={16} /> },
    { id: 'overview', label: 'Estatísticas', icon: <PieChartIcon size={16} /> },
    { id: 'diary', label: 'Diário', icon: <BookOpen size={16} /> },
    { id: 'categories', label: 'Categorias', icon: <Tags size={16} /> },
    { id: 'history', label: `Histórico (${history.length})`, icon: <History size={16} /> },
  ];

  return (
    <div
      id="project-details-container"
      data-testid="project-details-container"
      className="fade-in"
      style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', minHeight: '80vh' }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '4px dashed var(--color-primary)',
              pointerEvents: 'none',
            }}
          >
            <h2 style={{ color: 'white', fontSize: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <CopyPlus size={40} /> Solte seus PDFs aqui para importar
            </h2>
          </div>,
          document.body,
        )}

      <Link
        to="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          color: 'var(--text-muted)',
        }}
      >
        <ArrowLeft size={18} /> Voltar para Projetos
      </Link>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
        <ProjectHeader
          project={project}
          articlesCount={articles.length}
          isEditingName={isEditingName}
          setIsEditingName={setIsEditingName}
          newName={newName}
          setNewName={setNewName}
          handleUpdateName={handleUpdateName}
          handleDeleteProject={handleDeleteProject}
        />

        <ProjectToolbar
          project={project}
          projectDocuments={projectDocuments}
          setIsAIExtractionModalOpen={modals.setIsAIExtractionModalOpen}
          isAddArticlesMenuOpen={isAddArticlesMenuOpen}
          setIsAddArticlesMenuOpen={setIsAddArticlesMenuOpen}
          isExportMenuOpen={isExportMenuOpen}
          setIsExportMenuOpen={setIsExportMenuOpen}
          handleBatchPdfImport={handleBatchPdfImport}
          setIsImportArticlesModalOpen={modals.setIsImportArticlesModalOpen}
          setIsManualModalOpen={modals.setIsManualModalOpen}
          setIsCategoriesModalOpen={modals.setIsCategoriesModalOpen}
          setIsQuickAccessModalOpen={modals.setIsQuickAccessModalOpen}
          addArticlesMenuRef={addArticlesMenuRef}
          exportMenuRef={exportMenuRef}
          handleAddMenuMouseEnter={handleAddMenuMouseEnter}
          handleAddMenuMouseLeave={handleAddMenuMouseLeave}
          handleExportMenuMouseEnter={handleExportMenuMouseEnter}
          handleExportMenuMouseLeave={handleExportMenuMouseLeave}
        />
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '1.5rem',
          borderBottom: '2px solid var(--border-color)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.75rem 1.5rem',
              border: 'none',
              background: 'transparent',
              color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--text-muted)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '0.95rem',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              marginBottom: '-2px',
              transition: 'all var(--transition-fast)',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
        {activeTab === 'articles' && (
          <>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Search size={18} />
                </div>
                <input
                  type="text"
                  placeholder="Filtrar por título ou autor..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem 0.8rem 2.8rem',
                    fontSize: '1rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    boxShadow: 'var(--shadow-sm)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--color-primary)')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
                />
              </div>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-main)',
                  userSelect: 'none',
                  padding: '0.5rem 1rem',
                  background: onlyWithPdf ? 'var(--bg-surface)' : 'transparent',
                  border: '1px solid ' + (onlyWithPdf ? 'var(--color-primary)' : 'var(--border-color)'),
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all var(--transition-fast)',
                  boxShadow: onlyWithPdf ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyWithPdf}
                  onChange={(e) => {
                    setOnlyWithPdf(e.target.checked);
                    setCurrentPage(1);
                  }}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <span>Apenas com PDF vinculado</span>
              </label>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 500,
                  color: 'var(--text-main)',
                  userSelect: 'none',
                  padding: '0.5rem 1rem',
                  background: onlyOpenAccess ? 'var(--bg-surface)' : 'transparent',
                  border: '1px solid ' + (onlyOpenAccess ? 'var(--color-primary)' : 'var(--border-color)'),
                  borderRadius: 'var(--radius-lg)',
                  transition: 'all var(--transition-fast)',
                  boxShadow: onlyOpenAccess ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={onlyOpenAccess}
                  onChange={(e) => {
                    setOnlyOpenAccess(e.target.checked);
                    setCurrentPage(1);
                  }}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                />
                <span>Apenas Acesso Aberto</span>
              </label>

              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="btn-secondary"
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: isSidebarOpen ? 'var(--bg-surface)' : 'transparent',
                  border: '1px solid ' + (isSidebarOpen ? 'var(--color-primary)' : 'var(--border-color)'),
                  borderRadius: 'var(--radius-lg)',
                  color: isSidebarOpen ? 'var(--color-primary)' : 'var(--text-main)',
                  boxShadow: isSidebarOpen ? 'var(--shadow-sm)' : 'none',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                }}
              >
                <SlidersHorizontal size={18} /> Filtros
              </button>

              <div style={{ position: 'relative' }}>
                <select
                  value={sortOrder}
                  onChange={(e) => {
                    setSortOrder(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '0.8rem 1rem',
                    fontSize: '0.95rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  <option value="year-desc">Mais Recentes (Ano)</option>
                  <option value="year-asc">Mais Antigos (Ano)</option>
                  <option value="title-asc">Título (A-Z)</option>
                  <option value="title-desc">Título (Z-A)</option>
                  <option value="added-desc">Últimos Adicionados</option>
                  <option value="added-asc">Primeiros Adicionados</option>
                  <option value="citations-desc">Mais Citados (Citações)</option>
                  <option value="citations-asc">Menos Citados (Citações)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', width: '100%' }}>
              {isSidebarOpen && (
                <ProjectSidebar
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  uniqueDatabases={uniqueDatabases}
                  selectedDatabases={selectedDatabases}
                  setSelectedDatabases={setSelectedDatabases}
                  uniqueDocTypes={uniqueDocTypes}
                  selectedDocType={selectedDocType}
                  setSelectedDocType={setSelectedDocType}
                  keywordFrequencies={keywordFrequencies}
                  selectedKeyword={selectedKeyword}
                  setSelectedKeyword={setSelectedKeyword}
                  setCurrentPage={setCurrentPage}
                />
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                {readArticles.length > 0 && (
                  <details
                    className="custom-accordion"
                    onToggle={(e) => setIsReadArticlesOpen((e.target as HTMLDetailsElement).open)}
                    style={{
                      marginBottom: '1rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      padding: '1rem',
                    }}
                  >
                    <summary
                      style={{
                        fontWeight: 600,
                        color: 'var(--color-primary)',
                        cursor: 'pointer',
                        outline: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isReadArticlesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span>Artigos Lidos ({readArticles.length})</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          modals.setIsMassCitationModalOpen(true);
                        }}
                        className="btn-primary"
                        style={{
                          padding: '0.3rem 0.6rem',
                          fontSize: '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                      >
                        <CopyPlus size={12} /> Citação em Massa
                      </button>
                    </summary>
                    <div style={{ marginTop: '1rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <tbody>
                          {readArticles.map((article) => (
                            <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.75rem 1rem' }}>{article.title}</td>
                              <td style={{ padding: '0.75rem 1rem', width: '320px' }}>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                  <Link
                                    to={`/articles/${article.id}`}
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    Ver
                                  </Link>
                                  <button
                                    onClick={() => modals.setSelectedArticleForDetails(article)}
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    Detalhes
                                  </button>
                                  <button
                                    onClick={() => modals.setCitationArticle(article)}
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    Citar
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(article.id, 'new')}
                                    className="btn-secondary"
                                    style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                  >
                                    Desmarcar
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {archivedArticles.length > 0 && (
                  <details
                    className="custom-accordion"
                    onToggle={(e) => setIsArchivedArticlesOpen((e.target as HTMLDetailsElement).open)}
                    style={{
                      marginBottom: '1rem',
                      background: 'var(--bg-surface)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      padding: '1rem',
                    }}
                  >
                    <summary
                      style={{
                        fontWeight: 600,
                        color: 'var(--color-danger)',
                        cursor: 'pointer',
                        outline: 'none',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isArchivedArticlesOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        <span>Artigos Arquivados ({archivedArticles.length})</span>
                      </div>
                    </summary>
                    <div style={{ marginTop: '1rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <tbody>
                          {archivedArticles.map((article) => (
                            <tr key={article.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '0.75rem 1rem' }}>
                                <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{article.title}</div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                                  Motivo: {article.archive_note}
                                </div>
                              </td>
                              <td style={{ padding: '0.75rem 1rem', width: '150px' }}>
                                <button
                                  onClick={() => handleStatusChange(article.id, 'new')}
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Restaurar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                )}

                {/* Pagination info */}
                {activeArticles.length > ITEMS_PER_PAGE && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.75rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.875rem',
                    }}
                  >
                    <span>
                      Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
                      {Math.min(currentPage * ITEMS_PER_PAGE, activeArticles.length)} de {activeArticles.length} artigos
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span style={{ fontWeight: 600 }}>
                        {currentPage} / {totalPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                )}

                <ProjectArticlesList
                  paginatedArticles={paginatedArticles}
                  setSelectedArticleForDetails={modals.setSelectedArticleForDetails}
                  handleUnlinkClick={handleUnlinkClick}
                  handleUploadClick={handleUploadClick}
                  uploadingId={uploadingId}
                  handleStatusChange={handleStatusChange}
                  setEditingArticle={modals.setEditingArticle}
                  setArchivingId={modals.setArchivingId}
                  setCitationArticle={modals.setCitationArticle}
                  isArticleManual={isArticleManual}
                />

                {/* Bottom pagination */}
                {activeArticles.length > ITEMS_PER_PAGE && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      alignItems: 'center',
                      marginBottom: '2rem',
                    }}
                  >
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      <ChevronLeft size={16} /> Anterior
                    </button>
                    <span style={{ padding: '0 1rem', color: 'var(--text-muted)' }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-secondary"
                      style={{ padding: '0.4rem 0.8rem' }}
                    >
                      Próxima <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab Content: Overview */}
        {activeTab === 'overview' && (
          <ProjectOverviewTab
            activeArticles={activeArticles}
            readArticles={readArticles}
            archivedArticles={archivedArticles}
            filteredArticles={filteredArticles}
          />
        )}

        {activeTab === 'categories' && (
          <ProjectCategoriesTab
            project={project}
            projectCategories={projectCategories}
            articleCategories={articleCategories}
            nonArchivedArticles={activeArticles}
          />
        )}

        {activeTab === 'diary' && id && <DiarySection projectId={parseInt(id)} />}

        {activeTab === 'history' && (
          <SearchHistoryModal
            isOpen={true}
            onClose={() => {}}
            history={history}
            embedded={true}
            onRevertSearch={handleRevertSearch}
          />
        )}

        <ProjectModalsContainer
          projectId={id ? parseInt(id) : 0}
          project={project}
          articles={articles}
          projectDocuments={projectDocuments}
          history={history}
          readArticles={readArticles}
          investigationHistory={investigationHistory}
          modals={modals}
          fetchData={fetchData}
          handleArchiveSubmit={handleArchiveSubmit}
          handleEditArticleSubmit={handleEditArticleSubmit}
          handleManualArticleSubmit={handleManualArticleSubmit}
          handleRevertSearch={handleRevertSearch}
          handleCloseAIExtractionModal={handleCloseAIExtractionModal}
          handleMassiveExtraction={handleMassiveExtraction}
          aiQuestions={aiQuestions}
          setAiQuestions={setAiQuestions}
          isExtracting={isExtracting}
          extractionProgress={extractionProgress}
          aiExtractionResults={aiExtractionResults}
          cancelExtractionRef={cancelExtractionRef}
          showKeyAlert={showKeyAlert}
          setShowKeyAlert={setShowKeyAlert}
          setActiveTab={setActiveTab}
        />
    </div>
  );
};
