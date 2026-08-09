import { UserRole, isOperatorRole } from '@repo/shared';
import type { BreadcrumbItem, IconName } from '@repo/ui';
import type { TFunction } from 'i18next';

/**
 * Operator console navigation.
 *
 * The staff console and the seller app are two products behind one login, so
 * their route tables are kept apart on purpose: `routeMeta.ts` describes the
 * seller shell, this file describes the operator shell. Nothing here links
 * back into `/dashboard` — an operator account cannot open it (the API
 * refuses seller surfaces for staff roles).
 */

/** Path without locale prefix. */
export const OPERATOR_ADMIN_PATH = '/admin';

export interface OperatorRoute {
  path: string;
  labelKey: string;
  icon: IconName;
  roles: readonly UserRole[];
}

/*
 * Only one operator route today. The `/support` console (SUPPORT role) was
 * removed 2026-08 when customer support moved to tawk.to — see CLAUDE.md
 * "Customer support widget — tawk.to". SUPPORT accounts are still kept out
 * of the seller app (`isOperatorRole`), but have no console to land on; see
 * `resolveHomePath` below.
 */
const OPERATOR_ROUTES: readonly OperatorRoute[] = [
  {
    path: OPERATOR_ADMIN_PATH,
    labelKey: 'translation:menu.admin',
    icon: 'gauge',
    roles: [UserRole.ADMIN],
  },
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
    return resolveOperatorRoutes(role)[0]?.path ?? '/login';
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
  role: UserRole | undefined,
  t: TFunction
): BreadcrumbItem[] {
  const home = resolveOperatorRoutes(role)[0];
  const items: BreadcrumbItem[] = [{ label: t('translation:operator.console'), path: home?.path }];
  const current = OPERATOR_ROUTES.find(
    (route) => pathWithoutLocale === route.path || pathWithoutLocale.startsWith(`${route.path}/`)
  );
  if (current) {
    items.push({ label: t(current.labelKey) });
  }
  return items;
}
