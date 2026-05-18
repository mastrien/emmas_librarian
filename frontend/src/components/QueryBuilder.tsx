import React from 'react';
import { QueryBlock } from '../types';
import { Plus, Trash2 } from 'lucide-react';

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

  return (
    <div className="query-builder" style={{ padding: '1rem', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h3 style={{ marginTop: 0 }}>Construtor de Query (Blocos)</h3>
      {blocks.map((block) => (
        <div key={block.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', alignItems: 'center' }}>
          <select 
            value={block.field} 
            onChange={(e) => updateBlock(block.id, { field: e.target.value as any })}
            style={{ padding: '0.4rem' }}
          >
            <option value="title">Título</option>
            <option value="year">Ano</option>
          </select>

          <select 
            value={block.type} 
            onChange={(e) => updateBlock(block.id, { type: e.target.value as any })}
            style={{ padding: '0.4rem' }}
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
            placeholder="Valor..."
            style={{ padding: '0.4rem', flexGrow: 1 }}
          />

          <button 
            onClick={() => removeBlock(block.id)}
            style={{ padding: '0.4rem', background: '#fee2e2', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            <Trash2 size={16} color="#ef4444" />
          </button>
        </div>
      ))}

      <button 
        onClick={addBlock}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.4rem', 
          padding: '0.5rem 1rem', 
          background: '#f0f9ff', 
          border: '1px dashed #0ea5e9', 
          borderRadius: '4px',
          cursor: 'pointer',
          color: '#0ea5e9',
          fontWeight: 'bold'
        }}
      >
        <Plus size={18} /> Adicionar Condição
      </button>
    </div>
  );
};
