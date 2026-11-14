import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { InvestigationNavList, SIDEBAR_INVESTIGATIONS, visibleInvestigations } from '../InvestigationNavList';
import { investigationPath } from '../investigationView';
import { record } from './investigationTestData';

// The list comes newest first: #8 … #1.
const history = Array.from({ length: 8 }, (_, i) => record(8 - i));

describe('visibleInvestigations', () => {
  it('keeps the most recent ones', () => {
    expect(visibleInvestigations(history, null, 3).map((r) => r.id)).toEqual([8, 7, 6]);
  });

  it('adds the open one when it is older, so the line you are on stays in the list', () => {
    expect(visibleInvestigations(history, 2, 3).map((r) => r.id)).toEqual([8, 7, 6, 2]);
  });

  it('does not repeat the open one when it is already among the recent', () => {
    expect(visibleInvestigations(history, 7, 3).map((r) => r.id)).toEqual([8, 7, 6]);
  });

  it('shows everything when the list is short', () => {
    expect(visibleInvestigations(history.slice(0, 2), null, 5)).toHaveLength(2);
  });
});

function renderList(path: string, items = history) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <InvestigationNavList
        projectId={3}
        history={items}
        run={null}
        pendingById={{}}
        auditedIds={[]}
        onPick={() => undefined}
      />
    </MemoryRouter>,
  );
  return within(screen.getByRole('navigation', { name: 'Investigações do projeto' }));
}

describe('InvestigationNavList with many investigations (sidebar)', () => {
  it(`lists the ${SIDEBAR_INVESTIGATIONS} most recent and a "Ver todas (8)" button that shows the rest and folds back`, () => {
    const nav = renderList(investigationPath(3, 'new'));

    expect(nav.getAllByRole('link', { name: /^#\d+/ })).toHaveLength(SIDEBAR_INVESTIGATIONS);
    fireEvent.click(nav.getByRole('button', { name: 'Ver todas (8)' }));
    expect(nav.getAllByRole('link', { name: /^#\d+/ })).toHaveLength(8);
    fireEvent.click(nav.getByRole('button', { name: 'Mostrar menos' }));

    expect(nav.getAllByRole('link', { name: /^#\d+/ })).toHaveLength(SIDEBAR_INVESTIGATIONS);
  });

  it('keeps the investigation that is open on screen in the list even when it is an old one', () => {
    const nav = renderList(investigationPath(3, 1));

    expect(nav.getByRole('link', { name: /^#1 / })).toBeInTheDocument();
    expect(nav.getAllByRole('link', { name: /^#\d+/ })).toHaveLength(SIDEBAR_INVESTIGATIONS + 1);
  });

  it('has no "Ver todas" when everything fits', () => {
    const nav = renderList(investigationPath(3, 'new'), history.slice(0, 3));

    expect(nav.queryByRole('button', { name: /Ver todas/ })).not.toBeInTheDocument();
  });
});
