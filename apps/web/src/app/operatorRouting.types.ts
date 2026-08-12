import type { UserRole } from '@repo/shared';
import type { IconName } from '@repo/ui';

/** Mirrors `AdminTabId` (`features/admin/AdminPage/AdminPage.types.ts`) without importing across the app/features boundary. */
export type AdminSectionId =
  | 'overview'
  | 'queues'
  | 'costs'
  | 'proxies'
  | 'listingQuality'
  | 'settings'
  | 'billing'
  | 'users'
  | 'ebayLimits'
  | 'listingFailures';

export interface OperatorRoute {
  /** Pathname without locale prefix — shared by every admin section. */
  path: string;
  /** Full href (pathname + query) this entry navigates to and is matched against. */
  href: string;
  /** `?tab=` value; undefined for the default section (overview, no query). */
  tab?: AdminSectionId;
  labelKey: string;
  icon: IconName;
  roles: readonly UserRole[];
}
