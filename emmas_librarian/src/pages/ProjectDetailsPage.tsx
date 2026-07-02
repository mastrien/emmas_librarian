import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjectService } from '../contexts/ServicesContext';
import { Project, Article } from '../types';
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Calendar,
  Search,
  Download,
  Upload,
  Loader2,
  CheckCircle,
  Archive,
  History,
  Edit2,
  Trash2,
  Check,
  X as XIcon,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  CopyPlus,
  Key,
  AlertCircle,
  Settings,
  Link as LinkIcon,
  File as FileIcon,
  PieChart as PieChartIcon,
  Tag,
  Tags,
  Brain,
  SlidersHorizontal,
  Filter,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
import { SearchHistoryModal } from '../components/modals/SearchHistoryModal';
import { ArchiveModal } from '../components/modals/ArchiveModal';
import { ManualArticleModal } from '../components/modals/ManualArticleModal';
import { AIExtractionModal } from '../components/modals/AIExtractionModal';
import { DiarySection } from '../components/common/DiarySection';
import { EditArticleModal } from '../components/modals/EditArticleModal';
import { ManageQuickAccessModal } from '../components/modals/ManageQuickAccessModal';
import { ProjectCategoriesModal } from '../components/modals/ProjectCategoriesModal';
import { CategoryCell } from '../components/common/CategoryCell';
import { CitationModal } from '../components/modals/CitationModal';
import { ArticleDetailsModal } from '../components/modals/ArticleDetailsModal';
import { MassCitationModal } from '../components/modals/MassCitationModal';
import { ProjectOverviewTab } from './ProjectDetails/components/ProjectOverviewTab';
import { ProjectSidebar } from './ProjectDetails/components/ProjectSidebar';
import { useGlobalError } from '../contexts/GlobalErrorContext';

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
  const [project, setProject] = useState<Project | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyWithPdf, setOnlyWithPdf] = useState(false);
  const [onlyOpenAccess, setOnlyOpenAccess] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'new' | 'read' | 'archived' | 'all'>('new');
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [activeTab, setActiveTab] = useState<string>('articles');
  const [currentPage, setCurrentPage] = useState(1);
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [projectCategories, setProjectCategories] = useState<any[]>([]);
  const [articleCategories, setArticleCategories] = useState<any[]>([]);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [isImportingPdfs, setIsImportingPdfs] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const navigate = useNavigate();

  const [isAIExtractionModalOpen, setIsAIExtractionModalOpen] = useState(false);
  const [aiQuestions, setAiQuestions] = useState<string[]>(['']);
  const [aiExtractionResults, setAiExtractionResults] = useState<any[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState({ current: 0, total: 0 });
  const [citationArticle, setCitationArticle] = useState<Article | null>(null);
  const [selectedArticleForDetails, setSelectedArticleForDetails] = useState<Article | null>(null);

  const [sortOrder, setSortOrder] = useState(() => {
    return localStorage.getItem('emmas_librarian_sort_order') || 'added-desc';
  });

  useEffect(() => {
    localStorage.setItem('emmas_librarian_sort_order', sortOrder);
  }, [sortOrder]);

  const cancelExtractionRef = useRef(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const [hasAiKey, setHasAiKey] = useState(false);
  const [showKeyAlert, setShowKeyAlert] = useState(false);

  const [projectDocuments, setProjectDocuments] = useState<any[]>([]);
  const [isQuickAccessModalOpen, setIsQuickAccessModalOpen] = useState(false);
  const [isMassCitationModalOpen, setIsMassCitationModalOpen] = useState(false);
  const [isReadArticlesOpen, setIsReadArticlesOpen] = useState(false);
  const [isArchivedArticlesOpen, setIsArchivedArticlesOpen] = useState(false);

  const [investigationHistory, setInvestigationHistory] = useState<any[]>([]);

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
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCloseAIExtractionModal = () => {
    setIsAIExtractionModalOpen(false);
    setAiQuestions(['']);
    setAiExtractionResults([]);
    setExtractionProgress({ current: 0, total: 0 });
    setIsExtracting(false);
  };

  const handleUploadClick = useCallback(
    async (articleId: number) => {
      setUploadingId(articleId);
      try {
        const filePath = await projectService.openPdfDialog();
        if (filePath) {
          await projectService.uploadPdf(articleId, filePath);
          await fetchData();
        }
      } catch (err) {
        alert('Erro ao fazer upload do PDF');
      } finally {
        setUploadingId(null);
      }
    },
    [fetchData],
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
    [fetchData],
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
    [],
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
    if (archivingId) {
      handleStatusChange(archivingId, 'archived', note);
      setArchivingId(null);
    }
  };

  const handleManualArticleSubmit = async (data: any, filePath?: string) => {
    if (!id) return;
    await projectService.createManualArticle(parseInt(id), data, filePath);
    await fetchData();
  };

  const handleEditArticleSubmit = async (data: any) => {
    if (!editingArticle) return;
    await projectService.updateArticleMetadata(editingArticle.id, data);
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
    setIsDragging(true);
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
      return extractionConfig.model_name
        ? `${providerName} (${extractionConfig.model_name})`
        : providerName;
    } catch {
      return 'Desconhecido';
    }
  };

  const saveArticleResult = async (
    invId: number,
    articleId: number,
    res: any,
    questions: string[],
  ): Promise<void> => {
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

  const saveSkippedArticleResults = async (
    invId: number,
    articleId: number,
    questions: string[],
  ): Promise<void> => {
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

          if (err.isAppError && err.code !== 'ERR_INTERNAL') {
            // Abort the extraction and show the global error modal immediately
            throw err;
          }
          if (err.message && (err.message.includes('429') || err.message.includes('QUOTA_EXCEEDED'))) {
            setShowQuotaModal(true);
            cancelExtractionRef.current = true;
            finalStatus = 'Erro: Quota Excedida';
            break;
          }
          results.push({ article, error: 'Falha ao processar.' });
          setAiExtractionResults([...results]);
          finalStatus = 'Erro Parcial';
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

  const keywordFrequencies = React.useMemo(() => {
    const freqs: { [key: string]: number } = {};
    articles.forEach((a) => {
      const parse = (kStr?: string) =>
        kStr
          ? kStr
              .split(';')
              .map((k) => k.trim())
              .filter(Boolean)
          : [];
      const keywords = [...parse(a.author_keywords), ...parse(a.index_keywords)];
      keywords.forEach((kw) => {
        const trimmed = kw.trim();
        if (trimmed) {
          freqs[trimmed] = (freqs[trimmed] || 0) + 1;
        }
      });
    });
    return Object.entries(freqs)
      .map(([keyword, count]) => ({ keyword, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [articles]);

  const uniqueDatabases = React.useMemo(() => {
    const dbs = new Set<string>();
    articles.forEach((a) => {
      if (a.source_databases) {
        try {
          const parsed = JSON.parse(a.source_databases);
          if (Array.isArray(parsed)) {
            parsed.forEach((db) => dbs.add(db));
          } else {
            dbs.add(parsed);
          }
        } catch {
          dbs.add(a.source_databases);
        }
      }
    });
    return Array.from(dbs);
  }, [articles]);

  const uniqueDocTypes = React.useMemo(() => {
    const types = new Set<string>();
    articles.forEach((a) => {
      if (a.document_type) {
        types.add(a.document_type);
      }
    });
    return Array.from(types);
  }, [articles]);

  const filteredArticles = articles.filter((a) => {
    const matchesSearch =
      (a.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.authors || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPdf = !onlyWithPdf || !!a.local_file_path;
    const matchesOpenAccess = !onlyOpenAccess || a.is_oa === 1;
    return matchesSearch && matchesPdf && matchesOpenAccess;
  });

  const sortedArticles = [...filteredArticles].sort((a, b) => {
    switch (sortOrder) {
      case 'year-desc':
        return (parseInt(b.year?.toString() || '0') || 0) - (parseInt(a.year?.toString() || '0') || 0);
      case 'year-asc':
        return (parseInt(a.year?.toString() || '0') || 0) - (parseInt(b.year?.toString() || '0') || 0);
      case 'title-asc':
        return (a.title || '').localeCompare(b.title || '');
      case 'title-desc':
        return (b.title || '').localeCompare(a.title || '');
      case 'added-desc':
        return (b.id || 0) - (a.id || 0);
      case 'added-asc':
        return (a.id || 0) - (b.id || 0);
      case 'citations-desc':
        return (b.citation_count || 0) - (a.citation_count || 0);
      case 'citations-asc':
        return (a.citation_count || 0) - (b.citation_count || 0);
      default:
        return 0;
    }
  });

  const activeArticles = sortedArticles.filter((a) => {
    // 1. Status filter
    if (statusFilter === 'new') {
      if (a.status !== 'new' && !!a.status) return false;
    } else if (statusFilter === 'read') {
      if (a.status !== 'read') return false;
    } else if (statusFilter === 'archived') {
      if (a.status !== 'archived') return false;
    }

    // 2. Database filter
    if (selectedDatabases.length > 0) {
      try {
        const articleBases = JSON.parse(a.source_databases || '[]');
        const hasMatch = selectedDatabases.some((db) => articleBases.includes(db));
        if (!hasMatch) return false;
      } catch {
        if (a.source_databases && !selectedDatabases.includes(a.source_databases)) return false;
      }
    }

    // 3. Document Type filter
    if (selectedDocType) {
      if (a.document_type !== selectedDocType) return false;
    }

    // 4. Keyword tag cloud filter
    if (selectedKeyword) {
      const parseKeywords = (kStr?: string) =>
        kStr
          ? kStr
              .split(';')
              .map((k) => k.trim().toLowerCase())
              .filter(Boolean)
          : [];
      const keywords = [...parseKeywords(a.author_keywords), ...parseKeywords(a.index_keywords)];
      if (!keywords.includes(selectedKeyword.toLowerCase())) return false;
    }

    return true;
  });
  const readArticles = sortedArticles.filter((a) => a.status === 'read');
  const archivedArticles = sortedArticles.filter((a) => a.status === 'archived');
  const nonArchivedArticles = sortedArticles.filter((a) => a.status !== 'archived');

  // Pagination
  const totalPages = Math.max(1, Math.ceil(activeArticles.length / ITEMS_PER_PAGE));
  const paginatedArticles = activeArticles.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
        <div>
          {isEditingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                style={{
                  fontSize: '2rem',
                  fontWeight: 700,
                  background: 'var(--bg-main)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-heading)',
                  padding: '0.2rem 0.5rem',
                  width: '100%',
                  maxWidth: '600px',
                }}
                autoFocus
              />
              <button onClick={handleUpdateName} className="btn-primary" style={{ padding: '0.5rem' }}>
                <Check size={20} />
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setNewName(project.name);
                }}
                className="btn-secondary"
                style={{ padding: '0.5rem' }}
              >
                <XIcon size={20} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <h1 style={{ margin: 0, fontSize: '2rem' }}>{project.name}</h1>
              <button
                onClick={() => setIsEditingName(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  display: 'flex',
                }}
              >
                <Edit2 size={20} />
              </button>
              <button
                onClick={handleDeleteProject}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-danger)',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  display: 'flex',
                }}
              >
                <Trash2 size={20} />
              </button>
            </div>
          )}
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Criado em {new Date(project.created_at).toLocaleDateString()} &middot; {articles.length} artigos no total
          </p>
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => projectService.exportBiblioshiny(project.id)}
            className="btn-secondary"
            title="Exportar no formato compatível com Biblioshiny"
          >
            <Download size={18} /> Biblioshiny
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setIsAIExtractionModalOpen(true)}
              className="btn-primary"
              title="Extração Inteligente IA"
            >
              <Brain size={18} /> Extração IA
            </button>
            <button onClick={handleBatchPdfImport} className="btn-secondary" title="Importar PDFs em Lote">
              <Upload size={18} /> Importar PDFs
            </button>
            <button
              onClick={() => setIsManualModalOpen(true)}
              className="btn-secondary"
              title="Adicionar artigo manualmente"
            >
              <Plus size={18} /> Manual
            </button>
          </div>
          <button
            onClick={async () => {
              await projectService.exportProject(project.id);
            }}
            className="btn-secondary"
            title="Exportar projeto completo com PDFs (.emmapcarc)"
          >
            <Download size={18} /> .emmapcarc
          </button>
          <Link to={`/projects/${project.id}/search`} className="btn-primary">
            <Search size={18} /> Nova busca
          </Link>
          <button
            onClick={() => setIsCategoriesModalOpen(true)}
            className="btn-secondary"
            title="Gerenciar categorias de artigos"
          >
            <Tag size={18} /> Criar categorias
          </button>
        </div>

        {/* Acesso rápido */}
        <div
          style={{
            marginTop: '0.5rem',
            background: 'var(--bg-surface)',
            padding: '1rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h3
              style={{
                margin: 0,
                fontSize: '1.1rem',
                color: 'var(--text-heading)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <LinkIcon size={16} /> Acesso rápido
            </h3>
            <button
              onClick={() => setIsQuickAccessModalOpen(true)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                transition: 'color var(--transition-fast)',
              }}
              title="Gerenciar acessos rápidos"
            >
              <Settings size={16} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {projectDocuments.length === 0 ? (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
                Nenhum link ou documento cadastrado. Clique na engrenagem para adicionar.
              </div>
            ) : (
              projectDocuments.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => projectService.openProjectDocument(doc.url, doc.local_file_path)}
                  className="btn-secondary fade-in"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.85rem',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  title={doc.url || doc.local_file_path}
                >
                  {doc.url ? (
                    <LinkIcon size={14} color="var(--color-primary)" />
                  ) : (
                    <FileIcon size={14} color="var(--color-secondary)" />
                  )}
                  {doc.title}
                </button>
              ))
            )}
          </div>
        </div>
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

      {/* Tab Content: Articles */}
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
                        setIsMassCitationModalOpen(true);
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
                                  onClick={() => setSelectedArticleForDetails(article)}
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem' }}
                                >
                                  Detalhes
                                </button>
                                <button
                                  onClick={() => setCitationArticle(article)}
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

              <div className="card" style={{ overflowX: 'auto', border: 'none', marginBottom: '2rem' }}>
                <table
                  data-testid="main-articles-table"
                  style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}
                >
                  <thead>
                    <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                      <th
                        style={{
                          padding: '1rem 1.5rem',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        }}
                      >
                        TÍTULO
                      </th>
                      <th
                        style={{
                          padding: '1rem 1.5rem',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        }}
                      >
                        AUTORES
                      </th>
                      <th
                        style={{
                          padding: '1rem 1.5rem',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        }}
                      >
                        BASES
                      </th>
                      <th
                        style={{
                          padding: '1rem 1.5rem',
                          color: 'var(--text-muted)',
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        }}
                      >
                        AÇÕES
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedArticles.map((article) => (
                      <tr
                        key={article.id}
                        style={{
                          borderBottom: '1px solid var(--border-color)',
                          transition: 'background var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-main)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '1.25rem 1.5rem', maxWidth: '350px' }}>
                          <div
                            onClick={() => setSelectedArticleForDetails(article)}
                            style={{
                              fontWeight: 600,
                              color: 'var(--color-primary)',
                              cursor: 'pointer',
                              marginBottom: '0.25rem',
                              lineHeight: '1.4',
                              transition: 'color var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = 'color-mix(in srgb, var(--color-primary) 80%, black)';
                              e.currentTarget.style.textDecoration = 'underline';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--color-primary)';
                              e.currentTarget.style.textDecoration = 'none';
                            }}
                          >
                            {article.title}
                          </div>
                          {article.doi && (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>DOI: {article.doi}</div>
                          )}
                        </td>
                        <td
                          style={{
                            padding: '1.25rem 1.5rem',
                            color: 'var(--text-main)',
                            fontSize: '0.9rem',
                            maxWidth: '250px',
                          }}
                        >
                          <div style={{ marginBottom: '0.4rem', fontWeight: 500 }}>
                            {article.authors || 'Autores desconhecidos'}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <Calendar size={14} color="var(--text-muted)" /> {article.year || 'N/A'}
                            </div>
                            {article.citation_count !== undefined && article.citation_count !== null && (
                              <span
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--color-primary)',
                                  fontWeight: 600,
                                  background: 'var(--bg-main)',
                                  padding: '0.1rem 0.4rem',
                                  borderRadius: 'var(--radius-sm)',
                                  border: '1px solid var(--border-color)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                }}
                              >
                                🎓 {article.citation_count} {article.citation_count === 1 ? 'citação' : 'citações'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {article.source_databases ? (
                              JSON.parse(article.source_databases as string).map((base: string) => {
                                const isManual = base === 'Manual';
                                return (
                                  <span
                                    key={base}
                                    style={{
                                      padding: '0.2rem 0.6rem',
                                      background: isManual ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-surface)',
                                      border: isManual
                                        ? '1px solid var(--color-danger)'
                                        : '1px solid var(--border-color)',
                                      borderRadius: 'var(--radius-xl)',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      color: isManual ? 'var(--color-danger)' : 'var(--color-primary)',
                                    }}
                                    title={
                                      isManual ? 'Metadados adicionados manualmente (podem conter erros)' : undefined
                                    }
                                  >
                                    {isManual ? '⚠️ Manual' : base}
                                  </span>
                                );
                              })
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                            {article.is_oa === 1 && (
                              <span
                                style={{
                                  padding: '0.2rem 0.6rem',
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  border: '1px solid var(--color-success, #10b981)',
                                  borderRadius: 'var(--radius-xl)',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: 'var(--color-success, #10b981)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.2rem',
                                }}
                              >
                                🔓 Acesso Aberto
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            {article.local_file_path ? (
                              <>
                                <Link
                                  to={`/articles/${article.id}`}
                                  className="btn-primary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                >
                                  <FileText size={14} /> Ler
                                </Link>
                                <button
                                  onClick={() => handleUnlinkClick(article.id)}
                                  className="btn-secondary"
                                  style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                                  title="Desvincular PDF"
                                >
                                  <XIcon size={14} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleUploadClick(article.id)}
                                disabled={uploadingId === article.id}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                title="Vincular PDF"
                              >
                                {uploadingId === article.id ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Upload size={14} />
                                )}{' '}
                                PDF
                              </button>
                            )}

                            {article.status === 'read' ? (
                              <button
                                onClick={() => handleStatusChange(article.id, 'new')}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                title="Desmarcar como Lido"
                              >
                                <CheckCircle size={14} /> Desmarcar
                              </button>
                            ) : article.status !== 'archived' ? (
                              <button
                                onClick={() => handleStatusChange(article.id, 'read')}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                title="Marcar como Lido"
                              >
                                <CheckCircle size={14} /> Lido
                              </button>
                            ) : null}

                            {isArticleManual(article) && (
                              <button
                                onClick={() => setEditingArticle(article)}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                title="Editar Metadados"
                              >
                                <Edit2 size={14} /> Editar
                              </button>
                            )}

                            {article.status === 'archived' ? (
                              <button
                                onClick={() => handleStatusChange(article.id, 'new')}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                title="Restaurar Artigo"
                              >
                                <History size={14} /> Restaurar
                              </button>
                            ) : (
                              <button
                                onClick={() => setArchivingId(article.id)}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--color-danger)' }}
                                title="Arquivar"
                              >
                                <Archive size={14} /> Arquivar
                              </button>
                            )}

                            <button
                              onClick={() => setCitationArticle(article)}
                              className="btn-secondary"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                              title="Gerar Citação"
                            >
                              <CopyPlus size={14} /> Citar
                            </button>

                            {article.doi && (
                              <a
                                href={`https://doi.org/${article.doi}`}
                                target="_blank"
                                rel="noreferrer"
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', textDecoration: 'none' }}
                                title="Abrir no Navegador"
                              >
                                <ExternalLink size={14} /> Buscar por DOI
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {activeArticles.length === 0 && (
                  <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Nenhum artigo ativo na biblioteca.
                  </div>
                )}
              </div>

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
        <div className="card fade-in" style={{ padding: '2rem' }}>
          <div
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}
          >
            <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Tags size={24} color="var(--color-primary)" /> Categorias e Extrações
            </h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const savedPath = await projectService.exportCsv(project.id);
                    if (savedPath) alert('CSV exportado com sucesso para: ' + savedPath);
                  } catch (err: any) {
                    alert('Erro ao exportar CSV: ' + err.message);
                  }
                }}
              >
                <Download size={18} /> Exportar CSV
              </button>
              <button
                className="btn-secondary"
                onClick={async () => {
                  try {
                    const savedPath = await projectService.exportXlsx(project.id);
                    if (savedPath) alert('XLSX exportado com sucesso para: ' + savedPath);
                  } catch (err: any) {
                    alert('Erro ao exportar XLSX: ' + err.message);
                  }
                }}
              >
                <Download size={18} /> Exportar XLSX
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ background: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                  <th
                    style={{
                      padding: '1rem 1.5rem',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                    }}
                  >
                    ARTIGO
                  </th>
                  {projectCategories.map((cat) => (
                    <th
                      key={cat.id}
                      style={{
                        padding: '1rem 1.5rem',
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cat.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {nonArchivedArticles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={projectCategories.length + 1}
                      style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}
                    >
                      Nenhum artigo encontrado.
                    </td>
                  </tr>
                ) : (
                  nonArchivedArticles.map((article) => (
                    <tr
                      key={article.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        transition: 'background var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-main)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '1rem 1.5rem', maxWidth: '300px' }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-heading)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            marginBottom: '0.25rem',
                          }}
                          title={article.title}
                        >
                          {article.title}
                        </div>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {article.authors} ({article.year})
                        </div>
                      </td>
                      {projectCategories.map((cat) => {
                        const valObj = articleCategories.find(
                          (ac) => ac.article_id === article.id && ac.category_id === cat.id,
                        );
                        return (
                          <td key={cat.id} style={{ padding: '1rem 1.5rem', color: 'var(--text-main)' }}>
                            {valObj && valObj.value ? valObj.value : '-'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Diary */}
      {activeTab === 'diary' && id && <DiarySection projectId={parseInt(id)} />}

      {/* Tab Content: History */}
      {activeTab === 'history' && (
        <SearchHistoryModal
          isOpen={true}
          onClose={() => setActiveTab('articles')}
          history={history}
          embedded={true}
          onRevertSearch={handleRevertSearch}
        />
      )}

      <ArchiveModal isOpen={archivingId !== null} onClose={() => setArchivingId(null)} onSubmit={handleArchiveSubmit} />

      <ProjectCategoriesModal
        isOpen={isCategoriesModalOpen}
        projectId={project.id}
        onClose={() => {
          setIsCategoriesModalOpen(false);
          fetchData();
        }}
      />

      {editingArticle && (
        <EditArticleModal
          isOpen={true}
          onClose={() => setEditingArticle(null)}
          article={editingArticle}
          onSubmit={handleEditArticleSubmit}
        />
      )}

      <ManualArticleModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleManualArticleSubmit}
      />

      {isHistoryOpen && (
        <SearchHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
          onRevertSearch={handleRevertSearch}
        />
      )}

      <AIExtractionModal
        isOpen={isAIExtractionModalOpen}
        onClose={handleCloseAIExtractionModal}
        articles={articles}
        articlesWithPdf={articles.filter((a) => !!a.local_file_path)}
        aiQuestions={aiQuestions}
        setAiQuestions={setAiQuestions}
        handleMassiveExtraction={handleMassiveExtraction}
        isExtracting={isExtracting}
        extractionProgress={extractionProgress}
        aiExtractionResults={aiExtractionResults}
        cancelExtractionRef={cancelExtractionRef}
        investigationHistory={investigationHistory}
        getInvestigationResults={projectService.getInvestigationResults}
      />

      {showQuotaModal &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="card fade-in"
              style={{ padding: '2rem', width: '400px', background: 'var(--bg-main)', textAlign: 'center' }}
            >
              <AlertCircle size={48} style={{ color: 'var(--color-danger)', margin: '0 auto 1rem auto' }} />
              <h3 style={{ margin: '0 0 1rem 0' }}>Limite de Cota Atingido</h3>
              <p style={{ margin: '0 0 1.5rem 0', color: 'var(--text-muted)' }}>
                A sua chave de API (OpenAI/Anthropic/Gemini) parece ter esgotado o limite de cota ou os créditos
                disponíveis. Verifique o seu provedor de IA e atualize as configurações no sistema.
              </p>
              <button
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setShowQuotaModal(false)}
              >
                Entendi
              </button>
            </div>
          </div>,
          document.body,
        )}

      {showKeyAlert &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(4px)',
            }}
          >
            <div
              className="card fade-in"
              style={{
                width: '100%',
                maxWidth: '450px',
                background: 'var(--bg-surface)',
                padding: '2.5rem',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  background: 'color-mix(in srgb, var(--color-primary) 10%, transparent)',
                  color: 'var(--color-primary)',
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                }}
              >
                <Key size={32} />
              </div>
              <h2 style={{ fontSize: '1.5rem', margin: '0 0 1rem 0' }}>Chave de IA Necessária</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
                Para usar os recursos de Inteligência Artificial, você precisa primeiro configurar sua chave de API
                (OpenAI, Gemini, Anthropic ou modelo local) nas configurações do sistema.
              </p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => setShowKeyAlert(false)} className="btn-secondary" style={{ flex: 1 }}>
                  Cancelar
                </button>
                <button onClick={() => navigate('/settings')} className="btn-primary" style={{ flex: 1 }}>
                  Configurações
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {isQuickAccessModalOpen && project && (
        <ManageQuickAccessModal
          isOpen={isQuickAccessModalOpen}
          onClose={() => setIsQuickAccessModalOpen(false)}
          projectId={project.id}
          documents={projectDocuments}
          onDocumentsChanged={fetchData}
        />
      )}
      <CitationModal
        isOpen={!!citationArticle}
        onClose={() => setCitationArticle(null)}
        article={citationArticle}
        onArticleUpdated={fetchData}
      />
      {isMassCitationModalOpen && (
        <MassCitationModal
          isOpen={isMassCitationModalOpen}
          onClose={() => setIsMassCitationModalOpen(false)}
          articles={readArticles}
          onArticlesUpdated={fetchData}
        />
      )}
      <ArticleDetailsModal
        isOpen={!!selectedArticleForDetails}
        onClose={() => setSelectedArticleForDetails(null)}
        article={selectedArticleForDetails}
      />
    </div>
  );
};
