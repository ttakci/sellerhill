import { describe, expect, it } from 'vitest';

import {
  activeStoreStorageKey,
  nextSearchForActiveStore,
  readRememberedStore,
  rememberStore,
  resolveActiveStoreId,
  recordListPath,
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
  it('a switch drops paging and the open record, drawer and hand-off', () => {
    expect(searchForStoreSwitch(new URLSearchParams('store=a&page=4&tpage=2&r=9&c=7&drawer=add&asins=B0X'), 'b', false).toString()).toBe('store=b');
  });
  it('a switch keeps the view the seller is in (tab, period, folder, draft view, filters)', () => {
    const next = searchForStoreSwitch(
      new URLSearchParams('store=a&tab=chart&period=thisWeek&granularity=day&status=draft&type=FROM_EBAY&folder=unread&tracking=all&flag=late&stage=to_purchase&from=dashboard&q=mat&page=3'),
      'b',
      false
    );
    expect(Object.fromEntries(next)).toEqual({
      store: 'b', tab: 'chart', period: 'thisWeek', granularity: 'day', status: 'draft', type: 'FROM_EBAY',
      folder: 'unread', tracking: 'all', flag: 'late', stage: 'to_purchase', from: 'dashboard', q: 'mat',
    });
  });
  it('following a record keeps the page’s own params', () => {
    const next = searchForStoreSwitch(new URLSearchParams('store=a&r=9'), 'b', true);
    expect(next.get('store')).toBe('b');
    expect(next.get('r')).toBe('9');
  });
});

describe('recordListPath', () => {
  it('a record page answers its list', () => {
    expect(recordListPath('/orders/123', '/orders/')).toBe('/orders');
    expect(recordListPath('/listings/abc', '/listings/')).toBe('/listings');
    expect(recordListPath('/listings/jobs/j1', '/listings/jobs')).toBe('/listings/jobs');
  });
  it('a list page is not a record page', () => {
    expect(recordListPath('/orders', '/orders')).toBeNull();
    expect(recordListPath('/listings/jobs', '/listings/jobs')).toBeNull();
    expect(recordListPath('/listings/all', '/listings/all')).toBeNull();
  });
  it('no route meta, no record page', () => {
    expect(recordListPath('/orders/1', undefined)).toBeNull();
  });
});
