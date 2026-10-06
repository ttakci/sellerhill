import { describe, expect, it } from 'vitest';

import { resolveRouteMeta } from './routeMeta';

describe('store-scoped routes', () => {
  it.each([
    '/dashboard',
    '/actions',
    '/listings',
    '/listings/all',
    '/listings/jobs',
    '/listings/abc',
    '/orders',
    '/orders/abc',
    '/messages',
    '/returns',
    '/campaigns',
    '/campaigns/123',
  ])('%s follows the active store', (path) => {
    expect(resolveRouteMeta(path)?.storeScoped).toBe(true);
  });
  it('places campaign list and detail in marketing with distinct breadcrumbs', () => {
    expect(resolveRouteMeta('/campaigns')?.section).toBe('marketing');
    expect(resolveRouteMeta('/campaigns/123')?.section).toBe('marketing');
    const breadcrumbs = resolveRouteMeta('/campaigns/123')?.breadcrumbs ?? [];
    expect(breadcrumbs[breadcrumbs.length - 1]?.labelKey).toBe('campaigns:campaigns.detail.breadcrumb');
    expect(resolveRouteMeta('/campaigns-extra')).toBeUndefined();
  });
  it.each(['/billing', '/settings', '/stores', '/profile', '/best-sellers'])('%s is store-independent', (path) => {
    expect(resolveRouteMeta(path)?.storeScoped ?? false).toBe(false);
  });
});
