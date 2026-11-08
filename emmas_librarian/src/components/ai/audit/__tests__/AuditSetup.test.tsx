import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvestigationAudit } from '../../../../types';
import { FakeDialogs, FakeDialogsProvider } from '../../../common/dialogs/__tests__/fakes/FakeDialogs';
import { AuditSetup } from '../AuditSetup';

const drawn: InvestigationAudit = {
  id: 1,
  investigation_id: 19,
  seed: 42,
  sample_percent: 10,
  min_per_question: 2,
  created_at: '2026-11-08',
};

function renderSetup(audit: InvestigationAudit | null, dialogs: FakeDialogs) {
  const onDraw = vi.fn();
  render(
    <FakeDialogsProvider dialogs={dialogs}>
      <AuditSetup audit={audit} onDraw={onDraw} />
    </FakeDialogsProvider>,
  );
  return onDraw;
}

describe('AuditSetup', () => {
  it('draws the first sample without asking', () => {
    const dialogs = new FakeDialogs();
    const onDraw = renderSetup(null, dialogs);

    fireEvent.click(screen.getByRole('button', { name: 'Sortear amostra' }));

    expect(dialogs.asked).toHaveLength(0);
    expect(onDraw).toHaveBeenCalledWith(expect.objectContaining({ samplePercent: 10, minPerQuestion: 2 }));
  });

  // Drawing again swaps the sample; marks outside the new one stop counting, so the app asks first.
  it('asks in the app window before drawing again, and keeps the sample on cancel', async () => {
    const dialogs = new FakeDialogs();
    dialogs.confirmMessage.mockReturnValueOnce(false);
    const onDraw = renderSetup(drawn, dialogs);

    fireEvent.click(screen.getByRole('button', { name: 'Sortear de novo' }));
    await waitFor(() => expect(dialogs.asked).toHaveLength(1));
    expect(onDraw).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sortear de novo' }));
    await waitFor(() => expect(onDraw).toHaveBeenCalledTimes(1));
    expect(dialogs.asked[1]).toMatchObject({ title: 'Sortear de novo', confirmLabel: 'Sortear de novo' });
  });
});
