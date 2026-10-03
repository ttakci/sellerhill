import { describe, expect, it } from 'vitest';

import { resolveRouteMeta } from './routeMeta';

describe('store-scoped routes', () => {
  it.each(['/dashboard', '/actions', '/listings', '/listings/all', '/listings/jobs', '/listings/abc', '/orders', '/orders/abc', '/messages', '/returns'])(
    '%s follows the active store',
    (path) => {
      expect(resolveRouteMeta(path)?.storeScoped).toBe(true);
    }
  );
  it.each(['/billing', '/settings', '/stores', '/profile', '/best-sellers'])('%s is store-independent', (path) => {
    expect(resolveRouteMeta(path)?.storeScoped ?? false).toBe(false);
  });
});
