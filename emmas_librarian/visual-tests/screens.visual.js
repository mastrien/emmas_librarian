const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { launchApp, getFirstWindow } = require('../e2e-tests/helpers');
const { visualDir } = require('./visualPaths');

// Every route of the app, captured on the example project. ID is the imported project's id.
const SCREENS = [
  ['dashboard', '/'],
  ['projeto', '/projects/ID'],
  ['busca', '/projects/ID/search'],
  ['investigacao', '/projects/ID/investigation'],
  ['revisao', '/projects/ID/review'],
  ['triagem-guiada', '/projects/ID/review/guided'],
  ['prisma', '/projects/ID/review/prisma'],
  ['avaliar', '/projects/ID/review/evaluation'],
  ['perguntar', '/ask'],
  ['configuracoes', '/settings'],
  ['pdfs', '/pdfs'],
  ['agenda', '/agenda'],
  ['agenda-lista', '/agenda', (window) => window.getByRole('button', { name: 'Lista de Prazos' }).click()],
  ['termos', '/terms'],
];
// The example project has no agenda. Two events with every kind of deadline (date, time, range, done), all in 2025:
// past deadlines are not "próximos", so the dashboard's deadline notice does not change with the day.
const SAMPLE_VENUES = [
  {
    title: 'Simpósio Brasileiro de Sensoriamento Remoto',
    acronym: 'SBSR',
    category: 'symposium',
    url: 'https://example.org/sbsr',
    color: '#db2777',
    milestones: [
      {
        label: 'Submissão',
        field_type: 'single',
        target_date: '2025-03-10',
        has_time: true,
        target_time: '23:59',
        status: 'completed',
      },
      {
        label: 'Evento',
        field_type: 'range',
        target_date: '2025-04-06',
        end_date: '2025-04-09',
        has_time: false,
        status: 'pending',
      },
    ],
  },
  {
    title: 'Revista Brasileira de Meteorologia',
    category: 'journal',
    milestones: [
      {
        label: 'Chamada especial',
        field_type: 'single',
        target_date: '2025-02-01',
        has_time: false,
        status: 'pending',
      },
    ],
  },
];

// What changes with the day or the run, hidden in every screen: the clock and the month calendar (dashboard, agenda),
// the PDF library's "Data de Adição" (the import time) and the backup Settings lists (made when the app opened).
// (Freezing the page clock was tried first: Playwright's clock failed on this Electron window now and then.)
const ALWAYS_MASKED = ['[data-testid="dashboard-clock"]', '[data-testid="date-calendar"]'];
// The title bar and the header are sticky, and the header its own GPU layer (.glass-panel has translateZ(0)); now
// and then both were drawn a pixel lower than the page under them. At scroll 0 static puts them in the same place,
// so the capture draws them static and without the layer, the same in every run.
const CAPTURE_STYLE = [
  '.glass-panel { transform: none !important; }',
  '.native-titlebar, header.glass-panel { position: static !important; }',
].join(' ');
const MASKS = {
  pdfs: (window) => [window.locator('table tbody tr td:nth-child(3)')],
  configuracoes: (window) => [window.getByText('Histórico de Backups Automáticos').locator('xpath=..')],
};
const THEMES = [
  { name: 'claro', mode: 'light', toneKey: 'theme_light_tone', tone: 'white' },
  { name: 'escuro', mode: 'dark', toneKey: 'theme_dark_tone', tone: 'neutral' },
];
const WIDTHS = [1440, 1000];
function projectFile() {
  const file = process.env.VISUAL_PROJECT_FILE;
  if (!file || !fs.existsSync(file)) {
    throw new Error(`VISUAL_PROJECT_FILE must point to an existing .emmapcarc; got ${JSON.stringify(file)}`);
  }
  return file;
}

async function importProject(window) {
  await window.getByTitle('Importar projeto (.emmapcarc)').click();
  await window.waitForURL(/\/projects\/\d+/, { timeout: 60000 });
  return Number(window.url().match(/projects\/(\d+)/)[1]);
}

async function applyTheme(window, theme) {
  await window.evaluate(({ mode, toneKey, tone }) => {
    localStorage.setItem('theme', mode);
    localStorage.setItem(toneKey, tone);
  }, theme);
  await window.reload();
  await window.waitForLoadState('domcontentloaded');
}

async function setWidth(electronApp, window, width) {
  await electronApp.evaluate(({ BrowserWindow }, w) => BrowserWindow.getAllWindows()[0].setContentSize(w, 900), width);
  // The first screen after a resize was taken while the layout still settled (header off by a pixel or two).
  await window.waitForFunction((w) => window.innerWidth === w, width);
  await window.waitForTimeout(1500);
}

// Screens load their data over IPC after the route changes (the project's article list made the page 1129 or 8441px
// tall depending on timing). Wait until the page height holds still for a while, at most 20s.
async function waitForStableLayout(window) {
  let last = -1;
  let still = 0;
  for (let i = 0; i < 50 && still < 3; i++) {
    await window.waitForTimeout(400);
    const height = await window.evaluate(() => document.documentElement.scrollHeight);
    still = height === last ? still + 1 : 0;
    last = height;
  }
}

// The first capture after a theme reload or a resize still caught the header a pixel off and Chromium's size
// overlay ("1440px × 900px", fading out). Open a screen and let it settle before the captures start.
async function warmUp(window) {
  await window.evaluate(() => (window.location.hash = '/'));
  await waitForStableLayout(window);
  await window.waitForTimeout(2000);
}

async function shoot(window, name, route, projectId, prepare) {
  await window.evaluate((r) => (window.location.hash = r), route.replace('ID', String(projectId)));
  await waitForStableLayout(window);
  if (prepare) {
    await prepare(window);
    await waitForStableLayout(window);
  }
  // The pointer stays where the last click happened and would leave a hover state on whatever is under it.
  await window.mouse.move(0, 0);
  // After a reload the focus sometimes lands on the first link (the logo) and draws its focus ring.
  await window.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  // Soft, so one changed screen does not hide the others.
  const screen = name.split('-').slice(0, -2).join('-');
  const mask = [...ALWAYS_MASKED.map((selector) => window.locator(selector)), ...(MASKS[screen]?.(window) ?? [])];
  await expect.soft(window).toHaveScreenshot(`${name}.png`, { fullPage: true, mask, style: CAPTURE_STYLE });
}

// The library the screens are taken from. Imported once, by the baseline run, then copied for every comparison:
// importing again changes data the screens show (the PDFs' "added" second, which can split differently).
const TEMPLATE_DIR = path.join(visualDir(), 'data-template');
const TEMPLATE_META = path.join(TEMPLATE_DIR, 'visual-meta.json');

async function buildTemplate() {
  fs.rmSync(TEMPLATE_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEMPLATE_DIR, { recursive: true });
  const electronApp = await launchApp({ E2E_MOCK_PROJECT_FILE: projectFile() }, { userDataDir: TEMPLATE_DIR });
  try {
    const window = await getFirstWindow(electronApp);
    const projectId = await importProject(window);
    await window.evaluate(async (venues) => {
      for (const venue of venues) await window.electronAPI.invoke('scientificVenue:create', venue);
    }, SAMPLE_VENUES);
    // Something in the trash, so Settings shows its list instead of "A lixeira está vazia". Its deletion date is
    // written once, into the template, and stays the same in every comparison.
    await window.evaluate(async () => {
      const project = await window.electronAPI.invoke('projects:create', 'Projeto excluído de exemplo');
      await window.electronAPI.invoke('projects:delete', project.id);
    });
    fs.writeFileSync(TEMPLATE_META, JSON.stringify({ projectId }));
  } finally {
    await electronApp.close();
  }
}

async function libraryForThisRun(updatingBaseline) {
  if (updatingBaseline || !fs.existsSync(TEMPLATE_META)) await buildTemplate();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emma-visual-data-'));
  fs.cpSync(TEMPLATE_DIR, dataDir, { recursive: true });
  return { dataDir, projectId: JSON.parse(fs.readFileSync(TEMPLATE_META, 'utf8')).projectId };
}

async function shootEverything(electronApp, window, projectId) {
  for (const theme of THEMES) {
    await applyTheme(window, theme);
    for (const width of WIDTHS) {
      await setWidth(electronApp, window, width);
      await warmUp(window);
      for (const [screen, route, prepare] of SCREENS) {
        const name = `${screen}-${theme.name}-${width}`;
        await test.step(name, () => shoot(window, name, route, projectId, prepare));
      }
    }
  }
}

test('every screen looks the same as the baseline', async () => {
  const updating = ['all', 'changed'].includes(test.info().config.updateSnapshots);
  const { dataDir, projectId } = await libraryForThisRun(updating);
  const electronApp = await launchApp({}, { userDataDir: dataDir });
  try {
    const window = await getFirstWindow(electronApp);
    await shootEverything(electronApp, window, projectId);
  } finally {
    await electronApp.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
