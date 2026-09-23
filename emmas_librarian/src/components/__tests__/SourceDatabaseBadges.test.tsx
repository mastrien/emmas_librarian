import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SourceDatabaseBadges } from '../common/SourceDatabaseBadges';

describe('SourceDatabaseBadges', () => {
  it('renders one badge per source', () => {
    render(<SourceDatabaseBadges sourceDatabases='["Scopus","OpenAlex"]' />);

    expect(screen.getByText('Scopus')).toBeInTheDocument();
    expect(screen.getByText('OpenAlex')).toBeInTheDocument();
  });

  it('flags manually added articles', () => {
    render(<SourceDatabaseBadges sourceDatabases='["Manual"]' />);

    expect(screen.getByText('⚠️ Manual')).toHaveAttribute('title', 'Metadados adicionados manualmente (podem conter erros)');
  });

  it('does not flag regular sources', () => {
    render(<SourceDatabaseBadges sourceDatabases='["Scopus"]' />);

    expect(screen.getByText('Scopus')).not.toHaveAttribute('title');
  });

  it('shows the placeholder when there are no sources', () => {
    render(<SourceDatabaseBadges sourceDatabases={null} emptyPlaceholder={<span>-</span>} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders nothing by default when there are no sources', () => {
    const { container } = render(<SourceDatabaseBadges sourceDatabases="[]" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('tolerates a bare legacy value instead of crashing', () => {
    render(<SourceDatabaseBadges sourceDatabases="Scopus" />);

    expect(screen.getByText('Scopus')).toBeInTheDocument();
  });
});
