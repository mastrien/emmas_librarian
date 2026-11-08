import { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SearchStrategyExport } from '../SearchStrategyExport';
import { SearchHistoryModal } from '../../SearchHistoryModal';
import { FakeDialogs, withFakeDialogs } from '../../../common/dialogs/__tests__/fakes/FakeDialogs';

let dialogs = new FakeDialogs();
beforeEach(() => {
  dialogs = new FakeDialogs();
});

describe('SearchStrategyExport (#45)', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    ['XLSX', 'xlsx'],
    ['Markdown', 'md'],
  ])('exports as %s and says where the file went', async (label, format) => {
    const onExport = vi.fn().mockResolvedValue('C:\\out\\estrategia');
    render(<SearchStrategyExport onExport={onExport} />, { wrapper: withFakeDialogs(dialogs) });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: `Exportar estratégia de busca (${label})` }));
    });

    expect(onExport).toHaveBeenCalledWith(format);
    expect(dialogs.informMessage).toHaveBeenCalledWith(expect.stringContaining('C:\\out\\estrategia'));
  });

  it('says nothing when the save dialog was cancelled', async () => {
    render(<SearchStrategyExport onExport={vi.fn().mockResolvedValue(null)} />, { wrapper: withFakeDialogs(dialogs) });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Exportar estratégia de busca (XLSX)' }));
    });

    expect(dialogs.informMessage).not.toHaveBeenCalled();
  });

  it('appears in the search history only when the page can export', () => {
    const { rerender } = render(<SearchHistoryModal isOpen onClose={vi.fn()} history={[]} embedded />, {
      wrapper: withFakeDialogs(dialogs),
    });
    expect(screen.queryByRole('button', { name: /Exportar estratégia de busca/ })).toBeNull();

    rerender(<SearchHistoryModal isOpen onClose={vi.fn()} history={[]} embedded onExportStrategy={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /Exportar estratégia de busca/ })).toHaveLength(2);
  });
});
