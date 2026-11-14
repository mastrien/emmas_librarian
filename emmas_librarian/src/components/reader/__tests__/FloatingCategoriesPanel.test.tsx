import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingCategoriesPanel } from '../FloatingCategoriesPanel';

const renderPanel = (isCategoriesOpen: boolean, setIsCategoriesOpen = vi.fn()) => {
  render(
    <FloatingCategoriesPanel
      articleId={1}
      isCategoriesOpen={isCategoriesOpen}
      setIsCategoriesOpen={setIsCategoriesOpen}
      projectCategories={[]}
      articleCategories={[]}
    />,
  );
  return setIsCategoriesOpen;
};

describe('FloatingCategoriesPanel', () => {
  it('renders nothing while closed', () => {
    renderPanel(false);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens as the app window, and closes with its X', () => {
    const setOpen = renderPanel(true);

    expect(screen.getByRole('dialog', { name: 'Categorias' })).toBeInTheDocument();
    expect(screen.getByText('Nenhuma categoria cadastrada.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    expect(setOpen).toHaveBeenCalledWith(false);
  });
});
