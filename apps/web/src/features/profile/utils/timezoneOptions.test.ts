import { describe, expect, it } from 'vitest';

import { getTimezoneOptions } from './timezoneOptions';

describe('getTimezoneOptions', () => {
  it('lists IANA zones sorted, labelled with the zone name', () => {
    const options = getTimezoneOptions();
    expect(options.length).toBeGreaterThan(100);
    expect(options.find((o) => o.value === 'Europe/Istanbul')?.label).toContain('Europe/Istanbul');
    const values = options.map((o) => o.value);
    expect([...values].sort()).toEqual(values);
  });

  it('always includes the current value even if the runtime does not list it', () => {
    expect(getTimezoneOptions('Etc/Unknown').some((o) => o.value === 'Etc/Unknown')).toBe(true);
  });
});
