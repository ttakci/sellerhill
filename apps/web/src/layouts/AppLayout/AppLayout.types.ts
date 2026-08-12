import type { SupportedLocale, UserDto } from '@repo/shared';
import type { BreadcrumbItem } from '@repo/ui';

export interface AppLayoutProps {
  user?: UserDto;
  onLogout: () => void;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  isLogoutConfirmOpen: boolean;
  pathWithoutLocale: string;
  userName: string;
  loadingIsLoading: boolean;
  themeMode: 'light' | 'dark';
  breadcrumbItems: BreadcrumbItem[];
  onToggleSidebar: () => void;
  onNavigate: (path: string) => void;
  onLogoutConfirm: () => void;
  onChangeLanguage: (lang: SupportedLocale) => void;
  onToggleTheme: () => void;
  onCloseMobileSidebar: () => void;
  onOpenLogoutConfirm: () => void;
  onCloseLogoutConfirm: () => void;
  onLocaleNavigate: (path: string) => void;
  i18nLanguage: string;
  openSections: { inventory: boolean; configuration: boolean };
  onToggleSection: (section: 'inventory' | 'configuration') => void;
  /**
   * Number of pending actions waiting on the seller, for the nav badge.
   * `0` hides the badge — a chip reading "0" is chrome, not information.
   */
  pendingActionCount: number;
  /** True when at least one pending action is critical, so the badge reads red. */
  hasCriticalActions: boolean;
}
