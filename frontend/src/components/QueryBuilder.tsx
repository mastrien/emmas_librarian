import React from 'react';
import { QueryBlock } from '../types';
import { Plus, Trash2, Filter } from 'lucide-react';

interface Props {
  blocks: QueryBlock[];
  onChange: (blocks: QueryBlock[]) => void;
}

export const QueryBuilder: React.FC<Props> = ({ blocks, onChange }) => {
  const addBlock = () => {
    const newBlock: QueryBlock = {
      id: Math.random().toString(36).substr(2, 9),
      field: 'title',
      value: '',
      type: 'contains'
    };
    onChange([...blocks, newBlock]);
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
  };

  const updateBlock = (id: string, updates: Partial<QueryBlock>) => {
    onChange(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const inputStyle = {
    padding: '0.6rem 0.8rem',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-main)',
    color: 'var(--text-main)',
    outline: 'none',
    transition: 'border-color var(--transition-fast)'
  };

  return (
    <div className="card" style={{ padding: '1.5rem', border: '1px solid var(--border-color)', boxShadow: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <Filter size={20} color="var(--color-primary)" />
        <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text-heading)' }}>Construtor de Query</h3>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {blocks.map((block) => (
          <div key={block.id} className="fade-in" style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            alignItems: 'center',
            background: 'var(--bg-surface)',
            padding: '0.5rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <select 
              value={block.field} 
              onChange={(e) => updateBlock(block.id, { field: e.target.value as any })}
              style={inputStyle}
            >
              <option value="title">Título</option>
              <option value="year">Ano</option>
            </select>

            <select 
              value={block.type} 
              onChange={(e) => updateBlock(block.id, { type: e.target.value as any })}
              style={inputStyle}
            >
              {block.field === 'title' ? (
                <option value="contains">Contém</option>
              ) : (
                <>
                  <option value="equals">Igual a</option>
                  <option value="greater_than">Posterior a</option>
                  <option value="less_than">Anterior a</option>
                </>
              )}
            </select>

            <input 
              type={block.field === 'year' ? 'number' : 'text'}
              value={block.value}
              onChange={(e) => updateBlock(block.id, { value: e.target.value })}
              placeholder="Digite o valor..."
              style={{ ...inputStyle, flexGrow: 1 }}
            />

            <button 
              type="button"
              onClick={() => removeBlock(block.id)}
              style={{ 
                padding: '0.6rem', 
                background: 'transparent', 
                border: 'none', 
                borderRadius: 'var(--radius-sm)', 
                cursor: 'pointer',
                color: '#ef4444',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>

      <button 
        type="button"
        onClick={addBlock}
        className="btn-secondary"
        style={{ width: '100%', borderStyle: 'dashed' }}
      >
        <Plus size={18} /> Adicionar Condição de Busca
      </button>
    </div>
  );
};
