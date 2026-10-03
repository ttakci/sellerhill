import { describe, expect, it } from 'vitest';

import { getStoreLabel, resolveRecordStoreLabel } from './storeLabel';

const store = (id: string, storeName = '', ebayUsername = '', sellerId = 'opaque') => ({
  id,
  storeName,
  ebayUsername,
  sellerId,
});

describe('getStoreLabel', () => {
  it('prefers the store name, then the username, then the seller id', () => {
    expect(getStoreLabel(store('a', 'Shop A', 'user_a'))).toBe('Shop A');
    expect(getStoreLabel(store('a', '', 'user_a'))).toBe('user_a');
    expect(getStoreLabel(store('a'))).toBe('opaque');
  });
});

describe('resolveRecordStoreLabel', () => {
  it('shows nothing with a single store', () => {
    expect(resolveRecordStoreLabel([store('a', 'Shop A')], 'a')).toBeNull();
  });

  it('labels the record with its own store when there are several', () => {
    const accounts = [store('a', 'Shop A'), store('b', 'Shop B')];
    expect(resolveRecordStoreLabel(accounts, 'b')).toBe('Shop B');
  });

  it('never guesses for a missing or unknown store id', () => {
    const accounts = [store('a', 'Shop A'), store('b', 'Shop B')];
    expect(resolveRecordStoreLabel(accounts, null)).toBeNull();
    expect(resolveRecordStoreLabel(accounts, 'gone')).toBeNull();
  });
});
