import React, { useState, useEffect } from 'react';
import { generateCitation, CitationStyle } from '../services/citationService';
import { X, Copy, Check } from 'lucide-react';

interface CitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: any;
}

export function CitationModal({ isOpen, onClose, article }: CitationModalProps) {
  const [style, setStyle] = useState<CitationStyle>('abnt');
  const [citationText, setCitationText] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && article) {
      setCitationText(generateCitation(article, style));
    }
  }, [isOpen, article, style]);

  if (!isOpen || !article) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(citationText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Gerar Citação</h2>
          <button className="btn-icon" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Formato da Citação:</label>
            <select 
              value={style} 
              onChange={e => setStyle(e.target.value as CitationStyle)}
              className="form-input"
              style={{ width: '100%', padding: '0.5rem' }}
            >
              <option value="abnt">ABNT</option>
              <option value="apa">APA</option>
              <option value="vancouver">Vancouver</option>
              <option value="harvard1">Harvard</option>
              <option value="ieee">IEEE</option>
            </select>
          </div>
          
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Pré-visualização:</label>
            <div 
              style={{ 
                padding: '1rem', 
                background: 'var(--bg-main)', 
                border: '1px solid var(--border-color)', 
                borderRadius: 'var(--radius-md)',
                minHeight: '80px',
                whiteSpace: 'pre-wrap'
              }}
            >
              {citationText}
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
  );
}
