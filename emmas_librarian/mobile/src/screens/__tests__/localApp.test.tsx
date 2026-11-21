import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { App, type AppEnvironment } from '../../App';
import { LocalWorkspace } from '../../local/LocalWorkspace';
import { MemoryWorkspaceStorage } from '../../local/__tests__/fakes/MemoryWorkspaceStorage';
import { LookProvider } from '../../look/LookContext';
import { DesktopFixture } from '../../sync/__tests__/support/DesktopFixture';
import { DEFAULT_APPEARANCE } from '../../../../src/theme/appearance';

class MapStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let desktop: DesktopFixture;
let storage: MemoryWorkspaceStorage;
let counter = 0;

const appFor = (scan?: () => Promise<string>): AppEnvironment => ({
  tokens: { read: () => null, write: () => undefined, clear: () => undefined },
  initialHash: '',
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/120',
  send: fetch,
  clearHash: () => undefined,
  local: {
    minimumSplashMs: 0,
    scan,
    open: () =>
      LocalWorkspace.open({
        state: storage,
        pdfs: storage.pdfs,
        identity: storage,
        wipe: () => storage.wipe(),
        crypto: desktop.crypto,
        send: desktop.send,
        clock: { now: () => '2026-11-21T09:00:00.000Z', newUuid: () => `p-${(counter += 1)}` },
        deviceName: 'Pixel of Ana',
      }),
  },
});

const renderApp = (scan?: () => Promise<string>) =>
  render(
    <LookProvider initial={DEFAULT_APPEARANCE} storage={new MapStorage()} root={document.documentElement}>
      <App environment={appFor(scan)} />
    </LookProvider>,
  );

beforeEach(() => {
  desktop = new DesktopFixture();
  storage = new MemoryWorkspaceStorage();
  counter = 0;
  window.location.hash = '#/';
});

afterEach(() => {
  desktop.close();
  document.documentElement.removeAttribute('data-theme');
});

async function goToSettings(): Promise<void> {
  fireEvent.click(await screen.findByRole('link', { name: 'Ajustes' }));
  await screen.findByRole('heading', { name: 'Ajustes' });
}

async function pairFromSettings(): Promise<void> {
  await goToSettings();
  fireEvent.change(screen.getByLabelText('Código de pareamento'), { target: { value: await desktop.pairingText() } });
  fireEvent.click(screen.getByRole('button', { name: 'Parear' }));
  await screen.findByText(/Pareado com Pixel of Ana/);
}

describe('opening', () => {
  it('shows the logo and name while the library opens, then the projects', async () => {
    renderApp();
    expect(screen.getByRole('heading', { name: "Emma's Librarian" })).toBeInTheDocument();
    expect(screen.getByAltText("Logo do Emma's Librarian")).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Projetos' })).toBeInTheDocument();
  });

  it('says a new phone has its own library and where to pair', async () => {
    renderApp();
    expect(await screen.findByText(/Pareie com o computador em Ajustes/)).toBeInTheDocument();
    expect(await screen.findByText('Nenhum projeto nesta biblioteca.')).toBeInTheDocument();
  });
});

describe('projects of the phone', () => {
  it('creates a project that stays on the phone and labels it so', async () => {
    renderApp();
    fireEvent.change(await screen.findByLabelText('Nome do projeto'), { target: { value: 'Ideias' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar projeto' }));

    const row = await screen.findByRole('link', { name: /Ideias/ });
    expect(within(row).getByText('Só no celular')).toBeInTheDocument();
  });
});

describe('pairing and syncing from Ajustes', () => {
  it('pairs with the pasted code, syncs, and then lists the computer’s project as synced', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('Revisão sistemática')");
    renderApp();
    await pairFromSettings();
    expect(screen.getByText(/Código de verificação/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar agora' }));
    await waitFor(() => expect(screen.getByText(/Última troca: .*2026/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('link', { name: 'Projetos' }));

    const row = await screen.findByRole('link', { name: /Revisão sistemática/ });
    expect(within(row).getByText('Sincronizado')).toBeInTheDocument();
  });

  it('says why a code was refused and keeps the form', async () => {
    renderApp();
    await goToSettings();
    fireEvent.change(screen.getByLabelText('Código de pareamento'), { target: { value: 'not a code' } });
    fireEvent.click(screen.getByRole('button', { name: 'Parear' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That is not a pairing code');
  });

  it('shows what waits for the computer after writing offline, and the computer decides it in the dry run', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('Revisão')");
    renderApp();
    await pairFromSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar agora' }));
    await waitFor(() => expect(screen.getByText(/Última troca: .*2026/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: 'Projetos' }));
    fireEvent.click(await screen.findByRole('link', { name: /Revisão/ }));
    fireEvent.click(await screen.findByRole('link', { name: 'Diário' }));
    fireEvent.change(await screen.findByLabelText('Página de hoje'), { target: { value: 'Escrito sem o computador' } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar página' }));
    expect(await screen.findByText('Salvo no celular.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Voltar' }));
    expect(await screen.findByText(/1 aguardando o computador/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Ajustes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sincronizar agora' }));
    await waitFor(() => expect(desktop.store.listPending()).toHaveLength(1));
    expect(screen.getByText(/1 alteração\(ões\) aguardando confirmação no computador/)).toBeInTheDocument();

    desktop.applyAllPending();
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar agora' }));
    await waitFor(() => expect(screen.getByText(/Nada aguardando o computador/)).toBeInTheDocument());
    expect(desktop.db.prepare('SELECT content FROM project_diary').get()).toEqual({
      content: 'Escrito sem o computador',
    });
  });
});

describe('unpairing', () => {
  it('asks first, names what would be lost, and then forgets the library', async () => {
    desktop.run("INSERT INTO projects (name) VALUES ('P')");
    renderApp();
    await pairFromSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Sincronizar agora' }));
    await waitFor(() => expect(screen.getByText(/Última troca: .*2026/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Desparear e apagar os dados deste celular' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Desparear' });
    expect(dialog).toHaveTextContent('0 alteração(ões) ainda não aplicadas');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desparear e apagar' }));

    expect(await screen.findByRole('button', { name: 'Parear' })).toBeInTheDocument();
    expect(storage.identity).toBeNull();
  });

  it('does nothing when cancelled', async () => {
    renderApp();
    await pairFromSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Desparear e apagar os dados deste celular' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByText(/Pareado com Pixel of Ana/)).toBeInTheDocument();
  });
});

describe('appearance', () => {
  it('changes mode, tone and accent on the page, like the desktop', async () => {
    renderApp();
    await goToSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    fireEvent.click(screen.getByRole('button', { name: 'Grafite quente' }));
    expect(document.documentElement.dataset.tone).toBe('warm');
    fireEvent.click(screen.getByRole('button', { name: 'Rosa' }));
    expect(document.documentElement.dataset.accent).toBe('pink');
  });

  it('offers the tones of the mode in use', async () => {
    renderApp();
    await goToSettings();
    expect(screen.getByRole('button', { name: 'Branco quente' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }));
    expect(screen.queryByRole('button', { name: 'Branco quente' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grafite neutro' })).toBeInTheDocument();
  });
});
