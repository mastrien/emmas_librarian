import { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { RemoteAccessSettings, serverAddress } from '../RemoteAccessSettings';
import { ServicesProvider } from '../../../../contexts/ServicesContext';
import { FakeProjectService, REMOTE_ACCESS_OFF } from '../../../../services/__tests__/fakes/FakeProjectService';
import { FakeDialogs, FakeDialogsProvider } from '../../../../components/common/dialogs/__tests__/fakes/FakeDialogs';
import type { RemoteAccessStatus } from '../../../../types/remoteAccess';

const ON: RemoteAccessStatus = {
  ...REMOTE_ACCESS_OFF,
  enabled: true,
  running: true,
  port: 47810,
  fingerprint: 'AB:CD:EF',
};
const PHONE = { id: 'd-1', name: 'Celular da Ana', pairedAt: '2026-11-10T12:00:00.000Z', lastSeenAt: null };

describe('serverAddress', () => {
  it('is the https address of this computer while the server runs', () => {
    expect(serverAddress(ON)).toBe('https://192.168.0.10:47810');
  });

  it.each([
    ['the server is off', REMOTE_ACCESS_OFF],
    ['the computer is on no network', { ...ON, addresses: [] }],
  ])('is null when %s', (_label, status) => {
    expect(serverAddress(status)).toBeNull();
  });
});

describe('RemoteAccessSettings', () => {
  let service: FakeProjectService;
  let dialogs: FakeDialogs;

  const show = async (status: RemoteAccessStatus) => {
    service.getRemoteAccessStatus.mockResolvedValue(status);
    const view = render(
      <ServicesProvider apiService={service}>
        <FakeDialogsProvider dialogs={dialogs}>
          <RemoteAccessSettings />
        </FakeDialogsProvider>
      </ServicesProvider>,
    );
    await screen.findByText('Permitir acesso pela rede local');
    return view;
  };
  const toggle = () => screen.getByRole('checkbox');

  beforeEach(() => {
    service = FakeProjectService.create();
    dialogs = new FakeDialogs();
  });

  it('starts off: no address, no pairing button, nobody paired', async () => {
    await show(REMOTE_ACCESS_OFF);

    expect(toggle()).not.toBeChecked();
    expect(screen.queryByText('Endereço')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parear um celular/ })).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum celular pareado.')).toBeInTheDocument();
  });

  it('turns the server on and then shows where it answers and its certificate fingerprint', async () => {
    service.setRemoteAccessEnabled.mockResolvedValue(ON);
    await show(REMOTE_ACCESS_OFF);

    fireEvent.click(toggle());

    expect(await screen.findByText('https://192.168.0.10:47810')).toBeInTheDocument();
    expect(screen.getByText('AB:CD:EF')).toBeInTheDocument();
    expect(service.setRemoteAccessEnabled).toHaveBeenCalledWith(true);
    expect(toggle()).toBeChecked();
  });

  it('moves the switch at once, while the server is still starting', async () => {
    service.setRemoteAccessEnabled.mockReturnValue(new Promise(() => undefined));
    await show(REMOTE_ACCESS_OFF);

    fireEvent.click(toggle());

    expect(toggle()).toBeChecked();
    expect(screen.queryByText('Endereço')).not.toBeInTheDocument();
  });

  it('says why the server did not start, and offers no pairing', async () => {
    await show({ ...REMOTE_ACCESS_OFF, enabled: true, error: 'listen EACCES' });

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível ligar o acesso: listen EACCES');
    expect(screen.queryByRole('button', { name: /Parear um celular/ })).not.toBeInTheDocument();
  });

  it('says the computer is on no network instead of offering a pairing that cannot work', async () => {
    await show({ ...ON, addresses: [] });

    expect(screen.getByText('Este computador não está em uma rede local.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Parear um celular/ })).not.toBeInTheDocument();
  });

  it('shows the pairing QR code and closes it, cancelling the code', async () => {
    await show(ON);

    fireEvent.click(screen.getByRole('button', { name: /Parear um celular/ }));
    const qr = await screen.findByAltText('Código QR de pareamento');

    expect(qr.getAttribute('src')).toContain(encodeURIComponent('<svg'));
    expect(screen.queryByRole('button', { name: /Parear um celular/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Fechar código/ }));

    await waitFor(() => expect(screen.queryByAltText('Código QR de pareamento')).not.toBeInTheDocument());
    expect(service.cancelRemotePairing).toHaveBeenCalledTimes(1);
  });

  it('shows a phone paired meanwhile once the code is closed', async () => {
    await show(ON);
    fireEvent.click(screen.getByRole('button', { name: /Parear um celular/ }));
    await screen.findByAltText('Código QR de pareamento');
    service.getRemoteAccessStatus.mockResolvedValue({ ...ON, devices: [PHONE] });

    fireEvent.click(screen.getByRole('button', { name: /Fechar código/ }));

    expect(await screen.findByText('Celular da Ana')).toBeInTheDocument();
  });

  it('cancels an open code when the person leaves the screen', async () => {
    const view = await show(ON);

    view.unmount();

    expect(service.cancelRemotePairing).toHaveBeenCalledTimes(1);
  });

  it('lists the paired phones and revokes one after confirmation', async () => {
    service.revokeRemoteDevice.mockResolvedValue(ON);
    await show({ ...ON, devices: [PHONE] });
    expect(screen.getByText(/último acesso: nunca/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));

    await waitFor(() => expect(screen.queryByText('Celular da Ana')).not.toBeInTheDocument());
    expect(dialogs.asked[0]).toMatchObject({ title: 'Revogar celular', danger: true });
    expect(service.revokeRemoteDevice).toHaveBeenCalledWith('d-1');
  });

  it('keeps the phone when the revoke is not confirmed', async () => {
    dialogs.confirmMessage.mockReturnValue(false);
    await show({ ...ON, devices: [PHONE] });

    fireEvent.click(screen.getByRole('button', { name: 'Revogar' }));
    await waitFor(() => expect(dialogs.asked).toHaveLength(1));
    await act(async () => {});

    expect(service.revokeRemoteDevice).not.toHaveBeenCalled();
    expect(screen.getByText('Celular da Ana')).toBeInTheDocument();
  });
});
