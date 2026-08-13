import { UserRole, isOperatorRole } from '@repo/shared';
import type { BreadcrumbItem, IconName } from '@repo/ui';
import type { TFunction } from 'i18next';

import type { AdminSectionId, OperatorRoute } from './operatorRouting.types';

/**
 * Operator console navigation.
 *
 * The staff console and the seller app are two products behind one login, so
 * their route tables are kept apart on purpose: `routeMeta.ts` describes the
 * seller shell, this file describes the operator shell. Nothing here links
 * back into `/dashboard` — an operator account cannot open it (the API
 * refuses seller surfaces for staff roles).
 */

/** Path without locale prefix. Every admin section shares this pathname — they differ only by `?tab=`. */
export const OPERATOR_ADMIN_PATH = '/admin';

const adminSection = (tab: AdminSectionId | undefined, icon: IconName, labelKey: string): OperatorRoute => ({
  path: OPERATOR_ADMIN_PATH,
  href: tab ? `${OPERATOR_ADMIN_PATH}?tab=${tab}` : OPERATOR_ADMIN_PATH,
  tab,
  labelKey,
  icon,
  roles: [UserRole.ADMIN],
});

/*
 * One operator page (`/admin`), ten sidebar entries — each section is a
 * `?tab=` query on the same page rather than its own route, so they live here
 * as one flat list instead of a nested route tree. The `/support` console
 * (SUPPORT role) was removed 2026-08 when customer support moved to tawk.to —
 * see CLAUDE.md "Customer support widget — tawk.to". SUPPORT accounts are
 * still kept out of the seller app (`isOperatorRole`), but have no console to
 * land on; see `resolveHomePath` below.
 */
const OPERATOR_ROUTES: readonly OperatorRoute[] = [
  adminSection(undefined, 'dashboard', 'admin:admin.tabs.overview'),
  adminSection('queues', 'list', 'admin:admin.tabs.queues'),
  adminSection('costs', 'coins', 'admin:admin.tabs.costs'),
  adminSection('listingQuality', 'star', 'admin:admin.tabs.listingQuality'),
  adminSection('settings', 'settings', 'admin:admin.tabs.settings'),
  adminSection('billing', 'payments', 'admin:admin.tabs.billing'),
  adminSection('users', 'users', 'admin:admin.tabs.users'),
  adminSection('ebayLimits', 'gauge', 'admin:admin.tabs.ebayLimits'),
  adminSection('listingFailures', 'block', 'admin:admin.tabs.listingFailures'),
];

/** Routes the role may open, in sidebar order. */
export function resolveOperatorRoutes(role: UserRole | undefined): readonly OperatorRoute[] {
  return role ? OPERATOR_ROUTES.filter((route) => route.roles.includes(role)) : [];
}

/**
 * Landing path for an account. Staff never land on the seller dashboard, and a
 * seller never lands on the console — this is the one place that decision is
 * made, so login, the layout guards and the root redirect cannot disagree.
 */
export function resolveHomePath(role: UserRole | undefined, hasConnectedAccounts: boolean): string {
  if (isOperatorRole(role)) {
    /* SUPPORT has no operator route since the /support console was removed
       (see file header). Falling back into the seller app or looping back
       into /admin would both be wrong (the API refuses seller surfaces for
       staff, and /admin itself redirects non-ADMIN back through this
       function) — /login is the only non-looping, non-privileged landing. */
    return resolveOperatorRoutes(role)[0]?.href ?? '/login';
  }
  return hasConnectedAccounts ? '/dashboard' : '/onboarding/ebay';
}

/** True when the path belongs to the operator console. */
export function isOperatorPath(pathWithoutLocale: string): boolean {
  return OPERATOR_ROUTES.some(
    (route) => pathWithoutLocale === route.path || pathWithoutLocale.startsWith(`${route.path}/`)
  );
}

/** Breadcrumbs for the operator shell — rooted at the console, not at Home. */
export function resolveOperatorBreadcrumbs(
  pathWithoutLocale: string,
  activeTab: string | null,
  role: UserRole | undefined,
  t: TFunction
): BreadcrumbItem[] {
  const home = resolveOperatorRoutes(role)[0];
  const items: BreadcrumbItem[] = [{ label: t('translation:operator.console'), path: home?.href }];
  const current = OPERATOR_ROUTES.find(
    (route) =>
      (pathWithoutLocale === route.path || pathWithoutLocale.startsWith(`${route.path}/`)) &&
      (route.tab ?? 'overview') === (activeTab ?? 'overview')
  );
  if (current) {
    items.push({ label: t(current.labelKey) });
  }
  return items;
}
