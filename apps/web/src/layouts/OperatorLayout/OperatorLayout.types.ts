import type { SupportedLocale, UserDto } from '@repo/shared';
import type { BreadcrumbItem, IconName } from '@repo/ui';

export interface OperatorNavItem {
  /** Href without locale prefix, e.g. `/admin` or `/admin?tab=queues` */
  path: string;
  labelKey: string;
  icon: IconName;
  isActive: boolean;
}

export interface OperatorLayoutProps {
  user?: UserDto;
  userName: string;
  navItems: OperatorNavItem[];
  breadcrumbItems: BreadcrumbItem[];
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  isLogoutConfirmOpen: boolean;
  loadingIsLoading: boolean;
  i18nLanguage: string;
  onToggleSidebar: () => void;
  onNavigate: (path: string) => void;
  onLocaleNavigate: (path: string) => void;
  onChangeLanguage: (lang: SupportedLocale) => void;
  onCloseMobileSidebar: () => void;
  onOpenLogoutConfirm: () => void;
  onCloseLogoutConfirm: () => void;
  onLogoutConfirm: () => void;
}
