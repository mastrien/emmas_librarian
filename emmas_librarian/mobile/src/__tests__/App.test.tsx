import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { App, type AppEnvironment } from '../App';
import { FakeDesktopServer, MemoryTokenStore } from '../session/__tests__/fakes/FakeDesktopServer';

let desktop: FakeDesktopServer;
let tokens: MemoryTokenStore;
let hashCleared: number;

const environment = (hash = ''): AppEnvironment => ({
  tokens,
  initialHash: hash,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Version/17.0 Safari/604.1',
  send: desktop.send,
  clearHash: () => {
    hashCleared += 1;
  },
});

const projectFile = (projectJson: object, name = 'tese.emmapcarc') =>
  new File([zipSync({ 'project.json': strToU8(JSON.stringify(projectJson)) })], name);
const chooseFile = (file: File) =>
  fireEvent.change(screen.getByLabelText('Arquivo de projeto'), { target: { files: [file] } });

beforeEach(() => {
  desktop = new FakeDesktopServer();
  desktop.results['projects:getAll'] = [{ id: 1, name: 'Tese do computador', created_at: '' }];
  tokens = new MemoryTokenStore();
  hashCleared = 0;
  // The app routes by the address fragment; each test starts at the root.
  window.location.hash = '';
});

describe('App opened from the pairing QR code', () => {
  it('pairs with the code, keeps the token, clears the code from the address and shows the library', async () => {
    render(<App environment={environment('#pair=codigo')} />);

    expect(await screen.findByText('Tese do computador')).toBeInTheDocument();
    expect(tokens.stored).toBe('token-do-celular');
    expect(hashCleared).toBe(1);
    expect(desktop.requests.find((request) => request.route === '/api/pair')?.body).toEqual({
      code: 'codigo',
      deviceName: 'iPhone (Safari)',
    });
  });

  it('says why a pairing failed and stays on the start screen, with nothing stored', async () => {
    render(<App environment={environment('#pair=vencido')} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('O código já foi usado ou venceu.');
    expect(screen.getByText('Conectar a este computador')).toBeInTheDocument();
    expect(tokens.stored).toBeNull();
  });
});

describe('App on a later visit', () => {
  it('goes straight to the library with the stored token', async () => {
    tokens.stored = desktop.token;
    render(<App environment={environment()} />);

    expect(await screen.findByText('Tese do computador')).toBeInTheDocument();
    expect(desktop.requests.some((request) => request.route === '/api/pair')).toBe(false);
  });

  it('disconnects: forgets the token and returns to the start screen', async () => {
    tokens.stored = desktop.token;
    render(<App environment={environment()} />);
    await screen.findByText('Tese do computador');

    fireEvent.click(screen.getByRole('button', { name: 'Desconectar' }));

    expect(await screen.findByText('Conectar a este computador')).toBeInTheDocument();
    expect(tokens.stored).toBeNull();
  });

  // #192: before this, every screen showed a loading error with a "try again" that could never work.
  it('returns to the start screen and says the access was revoked when the desktop refuses the token', async () => {
    tokens.stored = 'token-revogado';
    render(<App environment={environment()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('O acesso deste aparelho foi revogado no computador.');
    expect(screen.getByText('Conectar a este computador')).toBeInTheDocument();
    expect(tokens.stored).toBeNull();
  });

  it('does the same when the phone is revoked in the middle of a visit', async () => {
    tokens.stored = desktop.token;
    render(<App environment={environment()} />);
    await screen.findByText('Tese do computador');
    desktop.token = 'trocado-pela-revogacao';

    fireEvent.click(screen.getByText('Tese do computador'));

    expect(await screen.findByRole('alert')).toHaveTextContent('foi revogado');
    expect(tokens.stored).toBeNull();
  });

  it('explains how to pair when served by the desktop and not paired yet', async () => {
    render(<App environment={environment()} />);

    expect(await screen.findByText('Conectar a este computador')).toBeInTheDocument();
    expect(screen.getByText(/Configurações › Acesso pelo celular/)).toBeInTheDocument();
  });
});

describe('App on the copy published on the web', () => {
  beforeEach(() => {
    desktop.present = false;
    // A token left from a visit to the desktop's copy means nothing here.
    tokens.stored = 'token-de-outro-lugar';
  });

  it('offers only to open a project file', async () => {
    render(<App environment={environment()} />);

    expect(await screen.findByRole('button', { name: 'Escolher arquivo .emmapcarc' })).toBeInTheDocument();
    expect(screen.queryByText('Conectar a este computador')).not.toBeInTheDocument();
  });

  it('opens a project file read-only and closes it again', async () => {
    render(<App environment={environment()} />);
    await screen.findByRole('button', { name: 'Escolher arquivo .emmapcarc' });

    chooseFile(projectFile({ formatVersion: 2, project: { id: 7, name: 'Tese do arquivo' }, articles: [] }));

    expect(await screen.findByText('Tese do arquivo')).toBeInTheDocument();
    expect(screen.getByText('Arquivo aberto neste aparelho, somente leitura.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Fechar arquivo' }));
    expect(await screen.findByRole('button', { name: 'Escolher arquivo .emmapcarc' })).toBeInTheDocument();
    expect(tokens.stored).toBe('token-de-outro-lugar');
  });

  it.each([
    ['a file that is not a project', () => new File(['isto não é um zip'], 'foto.jpg'), /./],
    ['a project in a newer format', () => projectFile({ formatVersion: 99, project: {}, articles: [] }), /formato 99/],
  ])('says why %s could not be opened', async (_label, file, reason) => {
    render(<App environment={environment()} />);
    await screen.findByRole('button', { name: 'Escolher arquivo .emmapcarc' });

    chooseFile(file());

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(reason));
    expect(screen.getByRole('button', { name: 'Escolher arquivo .emmapcarc' })).toBeInTheDocument();
  });
});
