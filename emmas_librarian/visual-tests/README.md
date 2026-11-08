# Visual comparison (redesign, Arca 134)

The redesign's phases 1 to 3 move styles into classes and components without changing how a screen looks. This
spec captures every route of the app and compares a run of the new code with a baseline taken from the old code:
17 screens (the agenda twice, as cards and as the deadline list; the project page with its articles, statistics,
categories and history tabs), light and dark, 1440 and 1000 px wide, so 68 images. Two sample agenda events, all dated 2025, and a deleted project (for the trash list in Settings) are
added to the example project.

The images show the example project's data, so they live outside the repository and are never committed.

## Use

From `emmas_librarian/`, with the code **before** the change checked out:

```bash
export VISUAL_PROJECT_FILE=/path/to/exemplo_inpe.emmapcarc   # the example project; never a personal library
export VISUAL_SNAPSHOT_DIR=/path/outside/the/repo            # default: <tmp>/emma-visual-baseline
npm run visual:baseline
```

Then check out the change and run `npm run visual:compare`. For a change to the calendar, set
`VISUAL_KEEP_CALENDAR=1` for both runs, taken on the same day: the calendar is then compared instead of masked. Each screen that differs is reported with its name, and
`test-results/` holds the expected, actual and diff images. Afterwards, `npm run rebuild:node` before unit tests.

## What keeps it repeatable

Five comparisons in a row on the same code gave zero differences (again after the agenda events were added). What had to be handled:

- **One import.** The baseline run imports the project once into `<VISUAL_SNAPSHOT_DIR>/data-template`; every
  comparison starts from a copy of it. Importing again changed the PDFs' "added" second.
- **Dates of the day or of the run are masked:** the dashboard clock, the month calendar and the deadline badges'
  day counts (`data-testid` in `DashboardClock`, `DashboardCalendar` and `DeadlineBanner`), the PDF library's "Data de Adição" and the backup list in Settings.
  Playwright's `clock` was tried first and failed now and then on the Electron window.
- **Each screen waits** until the page height holds still (data arrives over IPC after the route changes), with the
  pointer moved to a corner (no hover) and nothing focused (a reload sometimes focused the logo link).
- **A warm-up screen** after each theme reload and resize, scroll at 0, and the title bar and header captured static
  and without the `translateZ(0)` layer: both are sticky and were sometimes drawn a pixel lower than the page.

## Tolerance

`maxDiffPixels: 150` per image absorbs font antialiasing. A real change shows up: making the "voltar" text 0.05rem
larger failed 30 of the 52 images. A change this small on a short text can stay under the tolerance (it did on
"Perguntar aos projetos" at 1000 px), so read the diff of anything you expect to move.
