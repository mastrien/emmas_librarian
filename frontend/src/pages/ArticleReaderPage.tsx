import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  PdfLoader, 
  PdfHighlighter, 
  Highlight, 
  Popup, 
  AreaHighlight 
} from 'react-pdf-highlighter';
import { projectService } from '../services/api';
import { Article, Highlight as MyHighlight } from '../types';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

export const ArticleReaderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [highlights, setHighlights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock PDF for now since we don't have a file manager yet
  // In a real app, this would be a local path or a Blob from the server
  const pdfUrl = article?.doi ? `https://arxiv.org/pdf/${article.doi}.pdf` : 'https://arxiv.org/pdf/1706.03762.pdf';

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        const [artData, highData] = await Promise.all([
          projectService.getArticle(parseInt(id)),
          projectService.getHighlights(parseInt(id))
        ]);
        setArticle(artData);
        // Map backend highlights to react-pdf-highlighter format
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
    };
    fetchData();
  }, [id]);

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

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem', background: 'white' }}>
        <Link to={`/projects/${article.projeto_id}`} style={{ textDecoration: 'none', color: '#64748b' }}>
          <ArrowLeft size={20} />
        </Link>
        <h2 style={{ margin: 0, fontSize: '1.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {article.titulo}
        </h2>
      </header>

      <div style={{ flexGrow: 1, position: 'relative', background: '#f8fafc' }}>
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.ctrlKey) {
                            addHighlight({ content, position, comment: { text: (e.target as HTMLTextAreaElement).value } });
                            hideTipAndSelection();
                          }
                        }}
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
                    key={index}
                    children={component}
                  />
                );
              }}
              highlights={highlights}
            />
          )}
        </PdfLoader>
      </div>
    </div>
  );
};
