import type { BreadcrumbItem } from '@repo/ui';
import type { TFunction } from 'i18next';

export type NavSection = 'inventory' | 'configuration';

export interface AppRouteMeta {
  /** Path without locale prefix, e.g. `/listings/all` */
  path: string;
  /** Exact match unless endsWithMatch is set */
  match?: 'exact' | 'prefix';
  section?: NavSection;
  /** Breadcrumb segments after home (label keys resolved via t) */
  breadcrumbs: Array<{
    labelKey: string;
    /** When set, segment is a link (path without locale) */
    path?: string;
    ns?: string;
  }>;
}

/**
 * Single source of truth for app shell navigation metadata.
 * AppLayout breadcrumbs and section auto-open derive from this list.
 */
export const APP_ROUTE_META: AppRouteMeta[] = [
  {
    path: '/dashboard',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [],
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
    path: '/listings/products',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'translation:menu.products' },
    ],
  },
  {
    path: '/listings/add',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.listings', path: '/listings' },
      { labelKey: 'listings:listings.breadcrumb.addProducts' },
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
    section: 'inventory',
    breadcrumbs: [{ labelKey: 'translation:menu.orders', path: '/orders' }],
  },
  {
    path: '/orders/all',
    match: 'exact',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.orders', path: '/orders' },
      { labelKey: 'orders:orders.all.title' },
    ],
  },
  {
    path: '/orders/',
    match: 'prefix',
    section: 'inventory',
    breadcrumbs: [
      { labelKey: 'translation:menu.orders', path: '/orders' },
      { labelKey: 'orders:orders.detail.title' },
    ],
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

export function resolveNavSection(pathWithoutLocale: string): NavSection | undefined {
  return resolveRouteMeta(pathWithoutLocale)?.section;
}
