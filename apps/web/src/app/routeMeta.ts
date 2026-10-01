import type { BreadcrumbItem } from '@repo/ui';
import type { TFunction } from 'i18next';

import type { AppRouteMeta } from './routeMeta.types';

export type { NavSection, AppRouteMeta } from './routeMeta.types';

/**
 * Single source of truth for app shell navigation metadata.
 * AppLayout breadcrumbs derive from this list.
 */
export const APP_ROUTE_META: AppRouteMeta[] = [
  {
    path: '/dashboard',
    match: 'exact',
    section: 'overview',
    breadcrumbs: [],
  },
  {
    path: '/actions',
    match: 'exact',
    section: 'overview',
    breadcrumbs: [{ labelKey: 'actionCenter:actionCenter.menu', path: '/actions' }],
  },
  {
    path: '/best-sellers',
    match: 'exact',
    section: 'discover',
    breadcrumbs: [{ labelKey: 'bestSellers:bestSellers.menu', path: '/best-sellers' }],
  },
  {
    path: '/listings',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'translation:menu.ebayListings' },
    ],
  },
  {
    path: '/listings/all',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'translation:menu.ebayListings' },
    ],
  },
  {
    path: '/listings/jobs',
    match: 'prefix',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'translation:menu.listingJobs' },
    ],
  },
  {
    path: '/listings/revisions',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'translation:menu.revisionHistory' },
    ],
  },
  {
    path: '/listings/products',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'translation:menu.products' },
    ],
  },
  {
    path: '/listings/',
    match: 'prefix',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'listings:listings.detail.breadcrumb' },
    ],
  },
  {
    path: '/orders',
    match: 'exact',
    section: 'sales',
    breadcrumbs: [{ labelKey: 'translation:menu.orders', path: '/orders' }],
  },
  {
    path: '/messages',
    match: 'exact',
    section: 'sales',
    fitsViewport: true,
    breadcrumbs: [{ labelKey: 'translation:menu.messages', path: '/messages' }],
  },
  {
    path: '/returns',
    match: 'exact',
    section: 'sales',
    breadcrumbs: [{ labelKey: 'translation:menu.returns', path: '/returns' }],
  },
  {
    path: '/orders/',
    match: 'prefix',
    section: 'sales',
    breadcrumbs: [
      { labelKey: 'translation:menu.orders', path: '/orders' },
      { labelKey: 'orders:orders.detail.title' },
    ],
  },
  /*
   * `/admin` is deliberately absent: it belongs to the operator console,
   * which has its own shell and its own route table (`operatorRouting.ts`).
   * This list describes the seller app only.
   */
  {
    path: '/billing',
    match: 'exact',
    section: 'configuration',
    breadcrumbs: [{ labelKey: 'translation:menu.billing', path: '/billing' }],
  },
  {
    path: '/settings',
    match: 'exact',
    section: 'configuration',
    breadcrumbs: [{ labelKey: 'translation:menu.settings', path: '/settings' }],
  },
  {
    path: '/settings/',
    match: 'prefix',
    section: 'configuration',
    breadcrumbs: [{ labelKey: 'translation:menu.settings', path: '/settings' }],
  },
  {
    path: '/stores',
    match: 'exact',
    section: 'configuration',
    breadcrumbs: [{ labelKey: 'translation:menu.stores' }],
  },
  {
    path: '/profile',
    match: 'exact',
    section: 'configuration',
    breadcrumbs: [{ labelKey: 'translation:menu.settings', path: '/settings' }],
  },
  {
    path: '/onboarding',
    match: 'prefix',
    section: 'configuration',
    breadcrumbs: [],
  },
];

function matches(meta: AppRouteMeta, path: string): boolean {
  if (meta.match === 'prefix') {
    return path === meta.path || path.startsWith(meta.path);
  }
  return path === meta.path;
}

export function resolveRouteMeta(pathWithoutLocale: string): AppRouteMeta | undefined {
  // Prefer longest/most specific match
  const candidates = APP_ROUTE_META.filter((m) => matches(m, pathWithoutLocale));
  if (candidates.length === 0) {
    return undefined;
  }
  return candidates.sort((a, b) => b.path.length - a.path.length)[0];
}

export function resolveBreadcrumbs(pathWithoutLocale: string, t: TFunction): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [{ label: '', path: '/dashboard', icon: 'home' }];
  if (pathWithoutLocale === '/dashboard' || pathWithoutLocale === '/') {
    return items;
  }

  const meta = resolveRouteMeta(pathWithoutLocale);
  if (!meta) {
    return items;
  }

  for (const seg of meta.breadcrumbs) {
    items.push({
      label: t(seg.labelKey),
      path: seg.path,
    });
  }
  return items;
}
