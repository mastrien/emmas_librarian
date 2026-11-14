import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TermsOfUsePage } from '../TermsOfUsePage';
import { sectionAtScroll } from '../Terms/TermsToc';
import { BASE_POLICIES, TERMS_SECTIONS, TERMS_VERSION } from '../Terms/termsContent';

describe('TermsOfUsePage (board 174)', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  it('names the version of the terms and has no back link (the title bar path replaces it)', () => {
    render(<TermsOfUsePage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Termos de uso e IA' })).toBeInTheDocument();
    expect(screen.getByText(`Atualizado na versão ${TERMS_VERSION}`)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Voltar aos projetos' })).not.toBeInTheDocument();
  });

  it('lists every base with its badge and a link that opens outside the app', () => {
    render(<TermsOfUsePage />);

    for (const policy of BASE_POLICIES) {
      expect(screen.getByText(policy.name)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: policy.linkLabel })).toHaveAttribute('href', policy.href);
    }
    expect(screen.getAllByText('Restritivo')).toHaveLength(2);
    expect(screen.getByText('Livre (CC0)')).toBeInTheDocument();
  });

  it('covers the bases the app searches, IEEE included, and warns in red that no lawyer reviewed it', () => {
    render(<TermsOfUsePage />);

    for (const name of ['IEEE Xplore', 'arXiv', 'Europe PMC']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(/NÃO foram revistos por um advogado/);
  });

  it('has a section anchor for each entry of "Nesta página"', () => {
    const { container } = render(<TermsOfUsePage />);

    for (const { id } of TERMS_SECTIONS) expect(container.querySelector(`#${id}`)).not.toBeNull();
  });

  it('scrolls to a section and marks it as the current one when its entry is clicked', () => {
    render(<TermsOfUsePage />);
    const toc = screen.getByRole('navigation', { name: 'Nesta página' });

    fireEvent.click(within(toc).getByRole('link', { name: 'Responsabilidade' }));

    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(within(toc).getByRole('link', { name: 'Responsabilidade' })).toHaveAttribute('aria-current', 'location');
    expect(within(toc).getByRole('link', { name: 'Local-first' })).not.toHaveAttribute('aria-current');
  });

  it('warns that the author answers for what goes to the AI', () => {
    render(<TermsOfUsePage />);

    expect(screen.getByRole('note')).toHaveTextContent(/Isenção de responsabilidade/);
  });

  it('follows the reading line: the last section already passed, the first before any', () => {
    const tops: Record<string, number> = { 'local-first': -400, 'dados-por-base': -20, 'ia-e-chaves': 300 };

    expect(sectionAtScroll((id) => tops[id], 160)).toBe('dados-por-base');
    expect(sectionAtScroll(() => 900, 160)).toBe('local-first');
    expect(sectionAtScroll(() => undefined, 160)).toBe('local-first');
  });
});
