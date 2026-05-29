import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryBuilder } from '../QueryBuilder';
import { QueryGroupNode, QueryRuleNode } from '../../types';

describe('QueryBuilder AST', () => {
  it('renders a rule node correctly', () => {
    const node: QueryRuleNode = { type: 'rule', field: 'title', operator: 'contains', value: 'cancer' };
    const onChangeMock = vi.fn();
    render(<QueryBuilder node={node} onChange={onChangeMock} />);
    
    expect(screen.getByDisplayValue('Título')).toBeDefined();
    expect(screen.getByDisplayValue('Contém')).toBeDefined();
    expect(screen.getByDisplayValue('cancer')).toBeDefined();
  });

  it('calls onChange when rule node changes', () => {
    const node: QueryRuleNode = { type: 'rule', field: 'all', operator: 'exact', value: '' };
    const onChangeMock = vi.fn();
    render(<QueryBuilder node={node} onChange={onChangeMock} />);
    
    const input = screen.getByPlaceholderText('Termo de busca...');
    fireEvent.change(input, { target: { value: 'test' } });
    
    expect(onChangeMock).toHaveBeenCalledWith({
      ...node,
      value: 'test'
    });
  });

  it('renders a group node and allows adding a rule', () => {
    const node: QueryGroupNode = { 
      type: 'group', 
      logicalOperator: 'AND', 
      children: [{ type: 'rule', field: 'all', operator: 'contains', value: 'foo' }] 
    };
    const onChangeMock = vi.fn();
    render(<QueryBuilder node={node} onChange={onChangeMock} />);
    
    expect(screen.getByText('E (AND)')).toBeDefined();
    expect(screen.getByDisplayValue('foo')).toBeDefined();
    
    const addRuleBtn = screen.getByText(/Regra/);
    fireEvent.click(addRuleBtn);
    
    expect(onChangeMock).toHaveBeenCalledWith({
      ...node,
      children: [
        node.children[0],
        { type: 'rule', field: 'all', operator: 'contains', value: '' }
      ]
    });
  });

  it('allows removing a child rule if there is more than 1', () => {
    const node: QueryGroupNode = { 
      type: 'group', 
      logicalOperator: 'OR', 
      children: [
        { type: 'rule', field: 'all', operator: 'contains', value: 'foo' },
        { type: 'rule', field: 'all', operator: 'contains', value: 'bar' }
      ] 
    };
    const onChangeMock = vi.fn();
    render(<QueryBuilder node={node} onChange={onChangeMock} />);
    
    const removeBtns = screen.getAllByTitle('Remover');
    expect(removeBtns).toHaveLength(2);
    
    fireEvent.click(removeBtns[0]);
    
    expect(onChangeMock).toHaveBeenCalledWith({
      ...node,
      children: [ node.children[1] ] // first one is removed
    });
  });
});
