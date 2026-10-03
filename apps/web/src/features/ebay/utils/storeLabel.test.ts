import { describe, expect, it } from 'vitest';

import { getStoreLabel } from './storeLabel';

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
