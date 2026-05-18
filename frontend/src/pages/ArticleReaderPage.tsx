import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  PdfLoader, 
  PdfHighlighter, 
  Highlight, 
  Popup, 
  AreaHighlight 
} from 'react-pdf-highlighter';
import { projectService } from '../services/api';
import { Article } from '../types';
import { ArrowLeft, Loader2, Upload, AlertCircle } from 'lucide-react';

export const ArticleReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pdfUrl = id ? projectService.getPdfUrl(parseInt(id)) : '';

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [artData, highData] = await Promise.all([
        projectService.getArticle(parseInt(id)),
        projectService.getHighlights(parseInt(id))
      ]);
      setArticle(artData);
      setHighlights(highData.map(h => ({
        id: h.id.toString(),
        position: h.position_data,
        content: { text: h.comment || '' },
        comment: { text: h.comment || '', emoji: '' }
      })));
    } catch (err) {
      console.error('Erro ao carregar artigo', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setUploading(true);
    try {
      await projectService.uploadPdf(parseInt(id), file);
      await fetchData();
    } catch (err) {
      alert('Erro ao fazer upload do PDF');
    } finally {
      setUploading(false);
    }
  };

  const addHighlight = async (highlight: any) => {
    if (!id) return;
    try {
      const response = await projectService.createHighlight(
        parseInt(id),
        'yellow',
        highlight.position,
        highlight.comment.text
      );
      setHighlights([{ ...highlight, id: response.id.toString() }, ...highlights]);
    } catch (err) {
      console.error('Erro ao salvar destaque', err);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando Leitor...</div>;
  if (!article) return <div style={{ textAlign: 'center', padding: '2rem' }}>Artigo não encontrado.</div>;

  const hasLocalFile = !!(article as any).local_file_path;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', overflow: 'hidden' }}>
          <Link to={`/projects/${article.projeto_id}`} style={{ textDecoration: 'none', color: '#64748b', flexShrink: 0 }}>
            <ArrowLeft size={20} />
          </Link>
          <h2 style={{ margin: 0, fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {article.titulo}
          </h2>
        </div>

        {!hasLocalFile && (
          <div>
            <input 
              type="file" 
              accept="application/pdf" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem', 
                padding: '0.5rem 1rem', 
                background: '#0ea5e9', 
                color: 'white', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Vincular PDF Local
            </button>
          </div>
        )}
      </header>

      <div style={{ flexGrow: 1, position: 'relative', background: '#f8fafc' }}>
        {!hasLocalFile ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%', 
            color: '#64748b',
            gap: '1rem'
          }}>
            <AlertCircle size={48} />
            <p style={{ fontSize: '1.1rem' }}>Este artigo ainda não possui um arquivo PDF vinculado.</p>
            <p style={{ fontSize: '0.9rem' }}>Faça o upload do arquivo para começar a ler e fazer anotações.</p>
          </div>
        ) : (
          <PdfLoader url={pdfUrl} beforeLoad={<div style={{ textAlign: 'center', padding: '2rem' }}><Loader2 className="animate-spin" /> Carregando PDF...</div>}>
            {(pdfDocument) => (
              <PdfHighlighter
                pdfDocument={pdfDocument}
                enableAreaSelection={(event) => event.altKey}
                onScrollChange={() => {}}
                scrollRef={() => {}}
                onSelectionFinished={(
                  position,
                  content,
                  hideTipAndSelection,
                  transformSelection
                ) => (
                  <Popup
                    popupContent={
                      <div style={{ padding: '1rem', background: 'white', border: '1px solid #ccc', borderRadius: '4px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
                        <textarea 
                          placeholder="Adicionar anotação..." 
                          style={{ width: '200px', height: '80px', marginBottom: '0.5rem', display: 'block' }}
                        />
                        <button 
                          onClick={() => {
                            const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
                            addHighlight({ content, position, comment: { text: textarea.value } });
                            hideTipAndSelection();
                          }}
                          style={{ padding: '0.3rem 0.6rem', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Salvar
                        </button>
                      </div>
                    }
                    onMouseOver={(popupContent) => transformSelection(popupContent, [])}
                  />
                )}
                highlightTransform={(
                  highlight,
                  index,
                  setTip,
                  hideTip,
                  viewportToScaled,
                  screenshot,
                  isScrolledTo
                ) => {
                  const isTextHighlight = !Boolean(highlight.content && highlight.content.image);

                  const component = isTextHighlight ? (
                    <Highlight
                      isScrolledTo={isScrolledTo}
                      position={highlight.position}
                      comment={highlight.comment}
                    />
                  ) : (
                    <AreaHighlight
                      isScrolledTo={isScrolledTo}
                      highlight={highlight}
                      onChange={() => {}}
                    />
                  );

                  return (
                    <Popup
                      key={index}
                      onMouseOver={(popupContent) =>
                        setTip(highlight, (highlight) => popupContent)
                      }
                      onMouseOut={hideTip}
                      children={component}
                    />
                  );
                }}
                highlights={highlights}
              />
            )}
          </PdfLoader>
        )}
      </div>
    </div>
  );
};
