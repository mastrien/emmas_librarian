import React, { useState, useEffect } from 'react';
import { generateCitation, CitationStyle, CitationOutputFormat } from '../services/citationService';
import { X, Copy, Check, FileText, Code, Braces } from 'lucide-react';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: any;
}

export function CitationModal({ isOpen, onClose, article }: CitationModalProps) {
  const [style, setStyle] = useState<CitationStyle>('abnt');
  const [format, setFormat] = useState<CitationOutputFormat>('html');
  const [citationText, setCitationText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && article) {
      setCitationText(generateCitation(article, style, format));
    }
  }, [isOpen, article, style, format]);

  if (!isOpen || !article) return null;

  const handleCopy = () => {
    const textToCopy = format === 'html' ? citationText.replace(/<[^>]+>/g, '') : citationText;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px', width: '90%' }}>
        <div className="modal-header">
          <h2>Gerar Citação</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estilo da Citação:</label>
            <select 
              value={style} 
              onChange={e => setStyle(e.target.value as CitationStyle)}
              className="form-input"
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem' }}
            >
              <option value="abnt">ABNT</option>
              <option value="apa">APA</option>
              <option value="vancouver">Vancouver</option>
              <option value="harvard1">Harvard</option>
              <option value="ieee">IEEE</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <button 
                onClick={() => setFormat('html')}
                className={format === 'html' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText size={16} /> Visualização (HTML)
              </button>
              <button 
                onClick={() => setFormat('text')}
                className={format === 'text' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Code size={16} /> Texto Simples
              </button>
              <button 
                onClick={() => setFormat('bibtex')}
                className={format === 'bibtex' ? 'btn-primary' : 'btn-secondary'}
                style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Braces size={16} /> BibTeX / LaTeX
              </button>
            </div>
            
            <div style={{ position: 'relative' }}>
              <div 
                style={{ 
                  padding: '1.5rem', 
                  background: 'var(--bg-main)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: 'var(--radius-md)',
                  minHeight: '120px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: format === 'html' ? 'normal' : 'pre-wrap',
                  fontFamily: format === 'html' ? 'inherit' : 'monospace',
                  fontSize: format === 'html' ? '1rem' : '0.9rem',
                  lineHeight: '1.6'
                }}
              >
                {format === 'html' ? (
                  <div dangerouslySetInnerHTML={{ __html: citationText }} />
                ) : (
                  citationText
                )}
              </div>
              <button 
                onClick={handleCopy}
                className="btn-primary"
                style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
