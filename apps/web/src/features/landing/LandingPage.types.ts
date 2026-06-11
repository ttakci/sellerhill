import type { SupportedLocale } from '@repo/shared';

export interface LandingPageProps {
  currentLocale: string;
  scrolled: boolean;
  mobileMenuOpen: boolean;
  onLocaleChange: (locale: SupportedLocale) => void;
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
}
