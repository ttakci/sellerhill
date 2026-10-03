import { describe, expect, it } from 'vitest';

import { activeStoreStorageKey, readRememberedStore, rememberStore, resolveActiveStoreId } from './activeStore';

const IDS = ['a', 'b', 'c'];

describe('resolveActiveStoreId', () => {
  it('prefers a URL store the seller owns', () => {
    expect(resolveActiveStoreId({ urlStoreId: 'b', rememberedStoreId: 'c', storeIds: IDS })).toBe('b');
  });
  it('ignores a URL store the seller does not own and uses the remembered one', () => {
    expect(resolveActiveStoreId({ urlStoreId: 'zzz', rememberedStoreId: 'c', storeIds: IDS })).toBe('c');
  });
  it('ignores a remembered store that is gone and falls back to the first', () => {
    expect(resolveActiveStoreId({ urlStoreId: null, rememberedStoreId: 'gone', storeIds: IDS })).toBe('a');
  });
  it('is null when the seller has no store', () => {
    expect(resolveActiveStoreId({ urlStoreId: 'a', rememberedStoreId: 'a', storeIds: [] })).toBeNull();
  });
  it('treats an empty URL value as absent', () => {
    expect(resolveActiveStoreId({ urlStoreId: '', rememberedStoreId: null, storeIds: IDS })).toBe('a');
  });
});

describe('remembered store', () => {
  it('keys the remembered choice per user', () => {
    expect(activeStoreStorageKey('u1')).toBe('sellerhill.activeStore.u1');
  });
  it('round-trips through localStorage and ignores a missing user', () => {
    rememberStore('u1', 'b');
    expect(readRememberedStore('u1')).toBe('b');
    expect(readRememberedStore('u2')).toBeNull();
    expect(readRememberedStore(null)).toBeNull();
  });
});
