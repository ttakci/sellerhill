import { describe, expect, it } from 'vitest';

import {
  activeStoreStorageKey,
  nextSearchForActiveStore,
  readRememberedStore,
  rememberStore,
  resolveActiveStoreId,
  searchForStoreSwitch,
} from './activeStore';

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

describe('nextSearchForActiveStore', () => {
  const params = (q: string) => new URLSearchParams(q);

  it('adds the store to a store-scoped page that has none', () => {
    expect(nextSearchForActiveStore(params('page=2'), 'a', true)?.toString()).toBe('page=2&store=a');
  });
  it('replaces a store that is not the active one', () => {
    expect(nextSearchForActiveStore(params('store=zzz&tab=x'), 'a', true)?.get('store')).toBe('a');
  });
  it('leaves the URL alone when it already names the active store', () => {
    expect(nextSearchForActiveStore(params('store=a'), 'a', true)).toBeNull();
  });
  it('never touches a page that is not store-scoped', () => {
    expect(nextSearchForActiveStore(params('store=zzz'), 'a', false)).toBeNull();
  });
  it('does nothing before a store is known', () => {
    expect(nextSearchForActiveStore(params(''), null, true)).toBeNull();
  });
});

describe('searchForStoreSwitch', () => {
  it('a switch starts the page over: only the store is kept', () => {
    expect(searchForStoreSwitch(new URLSearchParams('store=a&page=4&r=9'), 'b', false).toString()).toBe('store=b');
  });
  it('following a record keeps the page’s own params', () => {
    const next = searchForStoreSwitch(new URLSearchParams('store=a&r=9'), 'b', true);
    expect(next.get('store')).toBe('b');
    expect(next.get('r')).toBe('9');
  });
});
