import type { SupportedLocale } from '@repo/shared';

export interface LandingPageProps {
  currentLocale: string;
  onLocaleChange: (locale: SupportedLocale) => void;
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
}
