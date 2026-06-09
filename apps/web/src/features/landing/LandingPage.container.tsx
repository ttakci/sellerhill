import type { SupportedLocale } from '@repo/shared';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LandingPageComponent } from './LandingPage.component';

import { storeLocalePreference } from '@/utils/locale';

export const LandingPageContainer = (): React.ReactElement => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [currentLocale, setCurrentLocale] = useState(i18n.language);

  const handleLocaleChange = useCallback(
    (locale: SupportedLocale) => {
      storeLocalePreference(locale);
      void i18n.changeLanguage(locale);
      setCurrentLocale(locale);
    },
    [i18n]
  );

  const handleNavigateLogin = useCallback(() => {
    void navigate(`/${currentLocale}/login`);
  }, [navigate, currentLocale]);

  const handleNavigateRegister = useCallback(() => {
    void navigate(`/${currentLocale}/register`);
  }, [navigate, currentLocale]);

  return (
    <LandingPageComponent
      currentLocale={currentLocale}
      onLocaleChange={handleLocaleChange}
      onNavigateLogin={handleNavigateLogin}
      onNavigateRegister={handleNavigateRegister}
    />
  );
};

export default LandingPageContainer;
