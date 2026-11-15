import { describe, it, expect } from 'vitest';
import { commandSchemas } from '../commandSchemas';
import { DEFAULT_EXCLUSIONS } from '../toolPolicy';

describe('DEFAULT_EXCLUSIONS', () => {
  // A rule about a command that was renamed would hide nothing and nobody would notice.
  it.each(DEFAULT_EXCLUSIONS.map((exclusion) => [String(exclusion.pattern), exclusion] as const))(
    'still matches a command of the library: %s',
    (_label, exclusion) => {
      expect(commandSchemas().some((command) => exclusion.pattern.test(command.name))).toBe(true);
    },
  );
});
