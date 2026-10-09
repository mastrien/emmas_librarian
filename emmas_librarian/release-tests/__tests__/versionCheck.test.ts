// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { findUpgradeProblems } from '../versionCheck';

describe('findUpgradeProblems', () => {
  it('finds nothing when the app moved from the old version to the one being tested', () => {
    expect(findUpgradeProblems({ before: '1.1.23', after: '1.2.0', expected: '1.2.0' })).toEqual([]);
  });

  it('reports an installer that left the old version running', () => {
    const problems = findUpgradeProblems({ before: '1.1.23', after: '1.1.23', expected: '1.2.0' });

    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/still reports v1\.1\.23.*did not replace it/);
    expect(problems[1]).toMatch(/expected the app to report v1\.2\.0 .* got v1\.1\.23/);
  });

  it('reports a new version that is not the build under test', () => {
    const problems = findUpgradeProblems({ before: '1.1.23', after: '1.1.24', expected: '1.2.0' });

    expect(problems).toEqual(['expected the app to report v1.2.0 (package.json) after the upgrade, got v1.1.24']);
  });

  it('reports a test that "upgrades" from the version it is testing', () => {
    const problems = findUpgradeProblems({ before: '1.2.0', after: '1.2.0', expected: '1.2.0' });

    expect(problems).toEqual([
      'the app still reports v1.2.0 after installing the new build: the installer did not replace it',
    ]);
  });
});
