import type { SupportedLocale, UserDto } from '@repo/shared';
import type { BreadcrumbItem } from '@repo/ui';

import type { BillingUsageRow } from '@/features/billing/utils/usageRows.types';

export interface AppLayoutProps {
  user?: UserDto;
  onLogout: () => void;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  isLogoutConfirmOpen: boolean;
  pathWithoutLocale: string;
  /** True when the current route is the dedicated drafts view (`/listings/all?status=draft`). */
  isDraftsActive: boolean;
  userName: string;
  loadingIsLoading: boolean;
  breadcrumbItems: BreadcrumbItem[];
  onToggleSidebar: () => void;
  onNavigate: (path: string) => void;
  onLogoutConfirm: () => void;
  onChangeLanguage: (lang: SupportedLocale) => void;
  onCloseMobileSidebar: () => void;
  onOpenLogoutConfirm: () => void;
  onCloseLogoutConfirm: () => void;
  onLocaleNavigate: (path: string) => void;
  i18nLanguage: string;
  /**
   * Number of pending actions waiting on the seller, for the nav badge.
   * `0` hides the badge — a chip reading "0" is chrome, not information.
   */
  pendingActionCount: number;
  /** True when at least one pending action is critical, so the badge reads red. */
  hasCriticalActions: boolean;
  /**
   * The three billing meters (listings, tracking conversions, automatic orders)
   * for the profile-dropdown shortcut, pre-formatted by the shared builder.
   * Empty when the account has no subscription/plan yet — the block is then
   * omitted and only the "Billing" menu item remains.
   */
  billingUsageRows: BillingUsageRow[];
  /**
   * The current plan's localized name (e.g. "Growth") for the same dropdown
   * block. `null` when there is no resolved plan — the block is omitted then.
   */
  billingPlanName: string | null;
  /** Whether the usage meters under the plan-name row are expanded. */
  isProfileUsageOpen: boolean;
  onToggleProfileUsage: () => void;
}
