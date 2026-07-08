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
}
