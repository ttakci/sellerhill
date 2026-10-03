import { describe, expect, it } from 'vitest';

import { GLOBAL_SCOPE, resolveSettingsScope } from './storeScope';

const IDS = ['a', 'b'];

describe('resolveSettingsScope', () => {
  it('opens on the active store when the URL names no scope', () => {
    expect(resolveSettingsScope(null, 'b', IDS)).toBe('b');
  });
  it('honours an explicit "all stores"', () => {
    expect(resolveSettingsScope(GLOBAL_SCOPE, 'b', IDS)).toBe(GLOBAL_SCOPE);
  });
  it('honours a named store of the seller', () => {
    expect(resolveSettingsScope('a', 'b', IDS)).toBe('a');
  });
  it('reads a foreign store id as "all stores"', () => {
    expect(resolveSettingsScope('zzz', 'b', IDS)).toBe(GLOBAL_SCOPE);
  });
  it('trusts a named store until the store list has loaded (a deep link is not lost)', () => {
    expect(resolveSettingsScope('a', null, null)).toBe('a');
  });
  it('falls back to "all stores" when there is no active store yet', () => {
    expect(resolveSettingsScope(null, null, null)).toBe(GLOBAL_SCOPE);
  });
});
