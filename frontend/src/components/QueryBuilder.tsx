import React from 'react';
import { QueryASTNode, QueryGroupNode, QueryRuleNode, QueryField, QueryOperator } from '../types';
import { Plus, Trash2, GitBranch } from 'lucide-react';

interface Props {
  node: QueryASTNode;
  onChange: (node: QueryASTNode) => void;
}

export const QueryBuilder: React.FC<Props> = ({ node, onChange }) => {
  
  if (node.type === 'rule') {
    return (
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select 
          value={node.field} 
          onChange={(e) => onChange({ ...node, field: e.target.value as QueryField })}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none' }}
        >
          <option value="all">Todos os Campos</option>
          <option value="title">Título</option>
          <option value="abstract">Resumo</option>
          <option value="authors">Autores</option>
        </select>
        
        <select 
          value={node.operator} 
          onChange={(e) => onChange({ ...node, operator: e.target.value as QueryOperator })}
          style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none' }}
        >
          <option value="contains">Contém</option>
          <option value="exact">Exato</option>
          <option value="not_contains">Não Contém</option>
        </select>

        <input 
          type="text" 
          value={node.value} 
          onChange={(e) => onChange({ ...node, value: e.target.value })}
          placeholder="Termo de busca..."
          style={{ flexGrow: 1, padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', outline: 'none' }}
        />
      </div>
    );
  }

  // Node is a group
  const groupNode = node as QueryGroupNode;

  const updateChild = (index: number, newChild: QueryASTNode) => {
    const newChildren = [...groupNode.children];
    newChildren[index] = newChild;
    onChange({ ...groupNode, children: newChildren });
  };

  const removeChild = (index: number) => {
    const newChildren = [...groupNode.children];
    newChildren.splice(index, 1);
    onChange({ ...groupNode, children: newChildren });
  };

  const addRule = () => {
    onChange({
      ...groupNode,
      children: [...groupNode.children, { type: 'rule', field: 'all', operator: 'contains', value: '' }]
    });
  };

  const addGroup = () => {
    onChange({
      ...groupNode,
      children: [...groupNode.children, { type: 'group', logicalOperator: 'AND', children: [{ type: 'rule', field: 'all', operator: 'contains', value: '' }] }]
    });
  };

  return (
    <div style={{ 
      borderLeft: `2px solid ${groupNode.logicalOperator === 'AND' ? 'var(--color-primary)' : 'var(--color-secondary)'}`, 
      paddingLeft: '1rem', 
      marginBottom: '1rem' 
    }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select 
          value={groupNode.logicalOperator} 
          onChange={(e) => onChange({ ...groupNode, logicalOperator: e.target.value as 'AND' | 'OR' })}
          style={{ 
            padding: '0.3rem 0.5rem', 
            borderRadius: 'var(--radius-sm)', 
            border: 'none', 
            background: groupNode.logicalOperator === 'AND' ? 'var(--color-primary)' : 'var(--color-secondary)',
            color: 'white',
            fontWeight: 600,
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="AND">E (AND)</option>
          <option value="OR">OU (OR)</option>
        </select>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={addRule} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
            <Plus size={14} /> Regra
          </button>
          <button type="button" onClick={addGroup} className="btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>
            <GitBranch size={14} /> Subgrupo
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {groupNode.children.map((child, index) => (
          <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <div style={{ flexGrow: 1 }}>
              <QueryBuilder node={child} onChange={(newChild) => updateChild(index, newChild)} />
            </div>
            {groupNode.children.length > 1 && (
              <button type="button" onClick={() => removeChild(index)} style={{ background: 'transparent', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.5rem' }} title="Remover">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
