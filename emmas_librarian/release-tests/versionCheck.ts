export interface UpgradeVersions {
  /** Version the published release reported before the new build was installed. */
  before: string;
  /** Version reported by the app launched after installing the new build over it. */
  after: string;
  /** Version of the build being tested (package.json). */
  expected: string;
}

/**
 * What is wrong with an upgrade judged by the versions the app reports. Without this check, an installer that
 * exits 0 without replacing the files leaves the old app running on an intact library, and the data
 * comparison passes (v1.2.0 stayed on 1.1.23 this way).
 *
 * Usage:
 *   expect(findUpgradeProblems({ before: '1.1.23', after: '1.2.0', expected: '1.2.0' })).toEqual([]);
 */
export function findUpgradeProblems({ before, after, expected }: UpgradeVersions): string[] {
  const problems: string[] = [];
  if (after === before) {
    problems.push(`the app still reports v${after} after installing the new build: the installer did not replace it`);
  }
  if (after !== expected) {
    problems.push(`expected the app to report v${expected} (package.json) after the upgrade, got v${after}`);
  }
  return problems;
}
