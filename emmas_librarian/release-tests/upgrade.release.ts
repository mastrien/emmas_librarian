import { test, expect } from '@playwright/test';
import { findLostData } from './libraryDump';
import { findUpgradeProblems } from './versionCheck';
import {
  API_KEY,
  PACKAGE_VERSION,
  PREFERENCES,
  appVersion,
  checkKeyStorage,
  dumpInstalledLibrary,
  expectLibraryOnScreen,
  fillInstalledLibrary,
  install,
  keepAppLogs,
  launchInstalled,
  readPreferencesAndKey,
  refuseToTouchARealLibrary,
  setPreferencesAndKey,
} from './installedApp';

/**
 * Installs the published release, fills it with the full test library, installs the new build over it
 * the way the auto-updater does, and checks that nothing was lost. Runs before a release, on a clean
 * GitHub runner (.github/workflows/release-upgrade-test.yml).
 */
const OLD_INSTALLER = process.env.RELEASE_TEST_OLD_INSTALLER ?? '';
const NEW_INSTALLER = process.env.RELEASE_TEST_NEW_INSTALLER ?? '';

test.afterEach(keepAppLogs);

test('upgrading from the published release keeps the whole library', async () => {
  test.setTimeout(15 * 60 * 1000);
  refuseToTouchARealLibrary();

  await test.step('install the published release and let it create its library', async () => {
    install(OLD_INSTALLER, { tolerateCrash: true });
    const { app } = await launchInstalled();
    await app.close();
  });

  await test.step('fill the library with every kind of data the old schema can hold', fillInstalledLibrary);

  let versionBefore = '';
  await test.step('set preferences and an API key through the published release', async () => {
    const { app, page } = await launchInstalled();
    versionBefore = await appVersion(app);
    await setPreferencesAndKey(page);
    await checkKeyStorage(app);
    await expectLibraryOnScreen(page);
    await app.close();
  });

  const before = dumpInstalledLibrary('before-upgrade');

  await test.step('install the new build over it, as the auto-updater does', async () => {
    install(NEW_INSTALLER, { args: ['--updated'] });
  });

  let versionAfter = '';
  await test.step('the new version shows the library, the preferences and the API key', async () => {
    const { app, page } = await launchInstalled();
    versionAfter = await appVersion(app);
    const { prefs, key } = await readPreferencesAndKey(page);
    await expectLibraryOnScreen(page);
    await app.close();

    expect(prefs).toEqual(PREFERENCES);
    expect(key).toBe(API_KEY);
  });

  // The install must really have replaced the app: otherwise the old one reopens on an intact library.
  expect(findUpgradeProblems({ before: versionBefore, after: versionAfter, expected: PACKAGE_VERSION })).toEqual([]);
  expect(findLostData(before, dumpInstalledLibrary('after-upgrade'))).toEqual([]);
});
