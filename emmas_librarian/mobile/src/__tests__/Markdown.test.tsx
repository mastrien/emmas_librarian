import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Markdown } from '../Markdown';

describe('Markdown', () => {
  it('draws headings, emphasis and lists instead of their symbols', () => {
    render(<Markdown text={'## Leituras\n\nLi **dois** artigos:\n\n- Silva 2021\n- Souza 2020'} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Leituras' })).toBeInTheDocument();
    expect(screen.getByText('dois').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['Silva 2021', 'Souza 2020']);
    expect(document.body.textContent).not.toContain('**');
  });

  it('draws task lists and tables (GitHub flavour), as the desktop editor writes them', () => {
    render(<Markdown text={'- [x] ler\n- [ ] fichar\n\n| a | b |\n|---|---|\n| 1 | 2 |'} />);

    expect(screen.getAllByRole('checkbox').map((box) => (box as HTMLInputElement).checked)).toEqual([true, false]);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('opens web links in a new tab, cut off from this page', () => {
    render(<Markdown text="Ver [o edital](https://example.org/edital)." />);

    const link = screen.getByRole('link', { name: 'o edital' });
    expect(link).toHaveAttribute('href', 'https://example.org/edital');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  // Content comes from a library file or from the desktop: it must never run in the phone's page.
  it('shows HTML in the text as text and drops links that would run a script', () => {
    const { container } = render(
      <Markdown text={'<img src=x onerror="alert(1)"> <script>alert(2)</script>\n\n[clique](javascript:alert(3))'} />,
    );

    expect(container.querySelector('img, script')).toBeNull();
    expect(container.textContent).toContain('onerror');
    expect(container.querySelector('a')?.getAttribute('href') ?? '').not.toContain('javascript');
  });

  it('carries the class it is given, for where it is placed', () => {
    const { container } = render(<Markdown text="nota" className="m-highlight__note" />);

    expect(container.firstElementChild).toHaveClass('m-markdown', 'm-highlight__note');
  });
});
