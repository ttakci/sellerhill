import type { SupportedLocale, UserDto } from '@repo/shared';
import type { BreadcrumbItem, IconName } from '@repo/ui';

export interface OperatorNavItem {
  /** Path without locale prefix, e.g. `/admin` */
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
  themeMode: 'light' | 'dark';
  i18nLanguage: string;
  onToggleSidebar: () => void;
  onNavigate: (path: string) => void;
  onLocaleNavigate: (path: string) => void;
  onChangeLanguage: (lang: SupportedLocale) => void;
  onToggleTheme: () => void;
  onCloseMobileSidebar: () => void;
  onOpenLogoutConfirm: () => void;
  onCloseLogoutConfirm: () => void;
  onLogoutConfirm: () => void;
}
