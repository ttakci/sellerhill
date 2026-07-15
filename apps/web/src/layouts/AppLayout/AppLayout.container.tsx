import { type SupportedLocale } from '@repo/shared';
import { type BreadcrumbItem, useTheme, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import { AppLayout as AppLayoutComponent } from './AppLayout.component';

import { useGetMeQuery } from '@/features/auth/api/authApi';
import { logout, selectIsAuthenticated } from '@/features/auth/store/authSlice';
import { stripLocaleFromPath } from '@/utils/locale';
import { useLocale } from '@/utils/useLocale';

export const AppLayout: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const dispatch = useDispatch();

  const { buildPath } = useLocale();
  const { data: user } = useGetMeQuery();
  const { t, i18n } = useTranslation(['translation', 'listings', 'orders']);
  const { loadingState } = useUI();
  const { themeMode, toggleTheme } = useTheme();
  const { localeNavigate, changeLocale } = useLocale();

  // Strip locale prefix for path comparisons
  const pathWithoutLocale: string = stripLocaleFromPath(location.pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ inventory: true, configuration: true });

  // Close mobile sidebar on route change & auto-open the section containing the current route
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    setMobileSidebarOpen(false);

    const isInventoryRoute =
      pathWithoutLocale === '/dashboard' ||
      pathWithoutLocale.startsWith('/listings') ||
      pathWithoutLocale.startsWith('/orders');
    const isConfigurationRoute =
      pathWithoutLocale.startsWith('/settings') || pathWithoutLocale === '/profile' || pathWithoutLocale === '/stores';

    setOpenSections((prev) => ({
      inventory: isInventoryRoute ? true : prev.inventory,
      configuration: isConfigurationRoute ? true : prev.configuration,
    }));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [location.pathname, pathWithoutLocale]);

  const handleToggleSection = useCallback((section: 'inventory' | 'configuration') => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const userName = user ? `${user.firstName} ${user.lastName}` : t('translation:common.notSet');

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, []);

  const handleNavigate = useCallback(
    (path: string) => {
      localeNavigate(path);
    },
    [localeNavigate]
  );

  const handleLogout = useCallback(() => {
    void dispatch(logout());
    localeNavigate('/login');
    setIsLogoutConfirmOpen(false);
  }, [dispatch, localeNavigate]);

  const handleChangeLanguage = useCallback(
    (lang: SupportedLocale) => {
      changeLocale(lang);
    },
    [changeLocale]
  );

  const breadcrumbItems = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: '', path: '/dashboard', icon: 'home' }];

    if (pathWithoutLocale === '/dashboard' || pathWithoutLocale === '/') {
      return items;
    }

    if (pathWithoutLocale.startsWith('/listings')) {
      items.push({ label: t('translation:menu.listings'), path: '/listings' });
      if (pathWithoutLocale === '/listings/jobs') {
        items.push({ label: t('translation:menu.listingJobs') });
      } else if (pathWithoutLocale === '/listings/products') {
        items.push({ label: t('translation:menu.products') });
      } else if (pathWithoutLocale === '/listings/add') {
        items.push({ label: t('listings:listings.breadcrumb.addProducts') });
      } else if (pathWithoutLocale === '/listings') {
        items.push({ label: t('translation:menu.ebayListings') });
      }
    } else if (pathWithoutLocale.startsWith('/orders')) {
      items.push({ label: t('translation:menu.orders'), path: '/orders' });
      if (pathWithoutLocale !== '/orders') {
        items.push({ label: t('orders:orders.detail.title') });
      }
    } else if (pathWithoutLocale.startsWith('/settings') || pathWithoutLocale.startsWith('/listing-settings-groups')) {
      items.push({ label: t('translation:menu.settings'), path: '/settings' });
      if (pathWithoutLocale === '/settings/store') {
        items.push({ label: t('translation:menu.storeSettings') });
      } else if (pathWithoutLocale.includes('/settings/amazon-accounts')) {
        items.push({ label: t('translation:menu.amazonAccounts') });
      } else if (
        pathWithoutLocale.includes('/listing-settings-groups') ||
        pathWithoutLocale.includes('/settings/listing-groups')
      ) {
        items.push({ label: t('translation:menu.listingSettingsGroups') });
      }
      // /settings (hub) shows just "Settings" — no second breadcrumb item
    } else if (pathWithoutLocale === '/stores') {
      items.push({ label: t('translation:menu.stores') });
    }
    return items;
  }, [pathWithoutLocale, t]);

  if (!isAuthenticated) {
    return <Navigate to={buildPath('/login')} state={{ from: location }} replace />;
  }

  return (
    <AppLayoutComponent
      user={user}
      onLogout={handleLogout}
      sidebarCollapsed={sidebarCollapsed}
      mobileSidebarOpen={mobileSidebarOpen}
      isLogoutConfirmOpen={isLogoutConfirmOpen}
      pathWithoutLocale={pathWithoutLocale}
      userName={userName}
      loadingIsLoading={loadingState.isLoading}
      themeMode={themeMode}
      breadcrumbItems={breadcrumbItems}
      openSections={openSections}
      onToggleSidebar={handleToggleSidebar}
      onNavigate={handleNavigate}
      onLogoutConfirm={handleLogout}
      onChangeLanguage={handleChangeLanguage}
      onToggleTheme={toggleTheme}
      onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
      onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
      onCloseLogoutConfirm={() => setIsLogoutConfirmOpen(false)}
      onLocaleNavigate={localeNavigate}
      onToggleSection={handleToggleSection}
      i18nLanguage={i18n.language}
    />
  );
};

export default AppLayout;
