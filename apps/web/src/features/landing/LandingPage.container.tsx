import type { SupportedLocale } from '@repo/shared';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LandingPageComponent } from './LandingPage.component';

import { storeLocalePreference } from '@/utils/locale';

export const LandingPageContainer = (): React.ReactElement => {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const [currentLocale, setCurrentLocale] = useState(i18n.language);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route changes / resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleLocaleChange = useCallback(
    (locale: SupportedLocale) => {
      storeLocalePreference(locale);
      void i18n.changeLanguage(locale);
      setCurrentLocale(locale);
    },
    [i18n]
  );

  const handleNavigateLogin = useCallback(() => {
    setMobileMenuOpen(false);
    void navigate(`/${currentLocale}/login`);
  }, [navigate, currentLocale]);

  const handleNavigateRegister = useCallback(() => {
    setMobileMenuOpen(false);
    void navigate(`/${currentLocale}/register`);
  }, [navigate, currentLocale]);

  const handleToggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    <LandingPageComponent
      currentLocale={currentLocale}
      scrolled={scrolled}
      mobileMenuOpen={mobileMenuOpen}
      onLocaleChange={handleLocaleChange}
      onNavigateLogin={handleNavigateLogin}
      onNavigateRegister={handleNavigateRegister}
      onToggleMobileMenu={handleToggleMobileMenu}
      onCloseMobileMenu={handleCloseMobileMenu}
    />
  );
};

export default LandingPageContainer;
