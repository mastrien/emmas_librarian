import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { PhoneSyncSettings } from '../PhoneSyncSettings';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService, REMOTE_ACCESS_OFF } from '../../../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogs, FakeDialogsProvider } from '../../../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import type { PendingPhoneChange, RemoteAccessStatus } from '../../../../types/remoteAccess';

const ON: RemoteAccessStatus = {
  ...REMOTE_ACCESS_OFF,
  enabled: true,
  running: true,
  port: 47810,
  fingerprint: 'AB:CD',
};
const PAIRED: RemoteAccessStatus = {
  ...ON,
  syncDevice: {
    deviceId: 'd1',
    deviceName: 'Pixel da Ana',
    pairedAt: 1_700_000_000_000,
    verificationCode: '4F2A · 91C7 · D03B · 7E58',
  },
};
const CHANGES: PendingPhoneChange[] = [
  {
    opId: 'a',
    entity: 'project_diary',
    kind: 'insert',
    fields: { entry_date: '2026-11-21', content: 'Página nova' },
    current: null,
    changedAt: 't',
  },
  {
    opId: 'b',
    entity: 'annotations',
    kind: 'delete',
    fields: null,
    current: { content_markdown: 'Escala diferente' },
    changedAt: 't',
  },
];

let service: FakeProjectService;
let dialogs: FakeDialogs;

async function show(status: RemoteAccessStatus, changes: PendingPhoneChange[] = []) {
  service.getRemoteAccessStatus.mockResolvedValue(status);
  service.listPhoneChanges.mockResolvedValue(changes);
  render(
    <ServicesProvider apiService={service}>
      <FakeDialogsProvider dialogs={dialogs}>
        <PhoneSyncSettings />
      </FakeDialogsProvider>
    </ServicesProvider>,
  );
  await screen.findByText('Sincronizar com o celular');
}

beforeEach(() => {
  service = FakeProjectService.create();
  dialogs = new FakeDialogs();
});

describe('pairing', () => {
  it('asks to turn the local network access on first', async () => {
    await show(REMOTE_ACCESS_OFF);
    expect(screen.getByText(/Ligue o acesso pela rede local/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parear um celular para sincronizar/ })).not.toBeInTheDocument();
  });

  it('opens a QR code to pair, and closes it', async () => {
    await show(ON);
    fireEvent.click(screen.getByRole('button', { name: /Parear um celular para sincronizar/ }));
    expect(await screen.findByAltText('Código QR de pareamento para sincronizar')).toBeInTheDocument();
    expect(screen.getByText(/mesmo código de verificação/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar código' }));
    expect(screen.queryByAltText('Código QR de pareamento para sincronizar')).not.toBeInTheDocument();
  });

  it('says why a pairing could not start', async () => {
    service.startPhoneSyncPairing.mockRejectedValue(new Error('O acesso pelo celular não está ativo'));
    await show(ON);
    fireEvent.click(screen.getByRole('button', { name: /Parear um celular para sincronizar/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não está ativo');
  });

  it('shows the paired phone with its verification code, and no new pairing button', async () => {
    await show(PAIRED);
    expect(screen.getByText('Pixel da Ana')).toBeInTheDocument();
    expect(screen.getByText('4F2A · 91C7 · D03B · 7E58')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parear um celular para sincronizar/ })).not.toBeInTheDocument();
  });

  it('unpairs after asking', async () => {
    await show(PAIRED);
    fireEvent.click(screen.getByRole('button', { name: 'Desparear' }));
    await waitFor(() => expect(service.revokePhoneSync).toHaveBeenCalledTimes(1));
    expect(dialogs.asked[0].message).toContain('A chave dele deixa de funcionar');
  });

  it('keeps the phone when the question is declined', async () => {
    dialogs.confirmMessage.mockReturnValue(false);
    await show(PAIRED);
    fireEvent.click(screen.getByRole('button', { name: 'Desparear' }));
    await waitFor(() => expect(dialogs.asked).toHaveLength(1));
    expect(service.revokePhoneSync).not.toHaveBeenCalled();
  });
});

describe('review of the phone’s changes', () => {
  it('lists each change, the destructive one marked, nothing applied', async () => {
    await show(PAIRED, CHANGES);
    expect(screen.getByText(/2 alteração\(ões\) do celular aguardam/)).toBeInTheDocument();
    expect(screen.getByLabelText('Adicionar: Página nova')).toBeChecked();
    const deletion = screen.getByLabelText('Excluir: Escala diferente').closest('label');
    expect(deletion).toHaveClass('phone-change--danger');
    expect(service.applyPhoneChanges).not.toHaveBeenCalled();
  });

  it('applies what is chosen and refreshes the list', async () => {
    await show(PAIRED, CHANGES);
    fireEvent.click(screen.getByLabelText('Excluir: Escala diferente'));
    service.listPhoneChanges.mockResolvedValue([]);

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar 1' }));

    await waitFor(() => expect(service.applyPhoneChanges).toHaveBeenCalledWith(['a']));
    expect(await screen.findByText('Nenhuma alteração do celular aguardando.')).toBeInTheDocument();
  });

  it('rejects what is chosen', async () => {
    await show(PAIRED, CHANGES);
    fireEvent.click(screen.getByRole('button', { name: 'Rejeitar 2' }));
    await waitFor(() => expect(service.rejectPhoneChanges).toHaveBeenCalledWith(['a', 'b']));
  });

  it('disables both buttons when nothing is chosen', async () => {
    await show(PAIRED, CHANGES);
    fireEvent.click(screen.getByLabelText('Adicionar: Página nova'));
    fireEvent.click(screen.getByLabelText('Excluir: Escala diferente'));
    expect(screen.getByRole('button', { name: 'Aplicar 0' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rejeitar 0' })).toBeDisabled();
  });

  it('says nothing waits when the list is empty, and refreshes on demand', async () => {
    await show(PAIRED, []);
    expect(screen.getByText('Nenhuma alteração do celular aguardando.')).toBeInTheDocument();
    service.listPhoneChanges.mockResolvedValue(CHANGES);
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar lista de alterações' }));
    expect(await screen.findByText(/2 alteração\(ões\) do celular aguardam/)).toBeInTheDocument();
    expect(within(document.body).getAllByRole('checkbox')).toHaveLength(2);
  });
});
