import React from 'react';
import { QueryASTNode, QueryGroupNode, QueryRuleNode, QueryField, QueryOperator } from '../../types';
import { Plus, Trash2, GitBranch } from 'lucide-react';
import './queryBuilder.css';

interface Props {
  node: QueryASTNode;
  onChange: (node: QueryASTNode) => void;
}

const newRule = (): QueryRuleNode => ({ type: 'rule', field: 'all', operator: 'contains', value: '' });

const QueryRule: React.FC<{ node: QueryRuleNode; onChange: (node: QueryASTNode) => void }> = ({ node, onChange }) => (
  <div className="query-rule">
    <select value={node.field} onChange={(e) => onChange({ ...node, field: e.target.value as QueryField })}>
      <option value="all">Todos os Campos</option>
      <option value="title">Título</option>
      <option value="abstract">Resumo</option>
      <option value="authors">Autores</option>
    </select>

    <select value={node.operator} onChange={(e) => onChange({ ...node, operator: e.target.value as QueryOperator })}>
      <option value="contains">Contém</option>
      <option value="exact">Exato</option>
      <option value="not_contains">Não Contém</option>
    </select>

    <input
      type="text"
      value={node.value}
      onChange={(e) => onChange({ ...node, value: e.target.value })}
      placeholder="Termo de busca..."
    />
  </div>
);

const QueryGroupHead: React.FC<{ group: QueryGroupNode; onChange: (node: QueryASTNode) => void }> = ({
  group,
  onChange,
}) => {
  const add = (child: QueryASTNode) => onChange({ ...group, children: [...group.children, child] });
  return (
    <div className="query-group-head">
      <select
        className="query-group-operator"
        value={group.logicalOperator}
        onChange={(e) => onChange({ ...group, logicalOperator: e.target.value as 'AND' | 'OR' })}
      >
        <option value="AND">E (AND)</option>
        <option value="OR">OU (OR)</option>
      </select>

      <div className="query-group-actions">
        <button type="button" onClick={() => add(newRule())} className="btn-secondary">
          <Plus size={14} /> Regra
        </button>
        <button
          type="button"
          onClick={() => add({ type: 'group', logicalOperator: 'AND', children: [newRule()] })}
          className="btn-secondary"
        >
          <GitBranch size={14} /> Subgrupo
        </button>
      </div>
    </div>
  );
};

const QueryGroup: React.FC<{ group: QueryGroupNode; onChange: (node: QueryASTNode) => void }> = ({
  group,
  onChange,
}) => {
  const replaceChildren = (edit: (children: QueryASTNode[]) => void) => {
    const children = [...group.children];
    edit(children);
    onChange({ ...group, children });
  };
  return (
    <div className={`query-group query-group--${group.logicalOperator === 'AND' ? 'and' : 'or'}`}>
      <QueryGroupHead group={group} onChange={onChange} />
      <div className="query-children">
        {group.children.map((child, index) => (
          <div key={index} className="query-child">
            <div className="query-child-node">
              <QueryBuilder node={child} onChange={(next) => replaceChildren((c) => (c[index] = next))} />
            </div>
            {group.children.length > 1 && (
              <button
                type="button"
                onClick={() => replaceChildren((c) => c.splice(index, 1))}
                className="query-child-remove"
                title="Remover"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * The visual boolean query editor: a rule (field, operator, term) or an AND/OR group of rules and subgroups,
 * edited as a tree.
 *
 * @example <QueryBuilder node={ast} onChange={setAst} />
 */
export const QueryBuilder: React.FC<Props> = ({ node, onChange }) =>
  node.type === 'rule' ? (
    <QueryRule node={node} onChange={onChange} />
  ) : (
    <QueryGroup group={node} onChange={onChange} />
  );
