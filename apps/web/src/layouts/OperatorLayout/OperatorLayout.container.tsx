import { isOperatorRole, type SupportedLocale } from '@repo/shared';
import { useTheme, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import { OperatorLayout as OperatorLayoutComponent } from './OperatorLayout.component';
import type { OperatorNavItem } from './OperatorLayout.types';

import { resolveOperatorBreadcrumbs, resolveOperatorRoutes } from '@/app/operatorRouting';
import { useGetMeQuery, useLogoutMutation } from '@/features/auth/api/authApi';
import { logout, selectIsAuthenticated } from '@/features/auth/store/authSlice';
import { stripLocaleFromPath } from '@/utils/locale';
import { useLocale } from '@/utils/useLocale';

/**
 * Guarded shell for the staff console (`/admin`).
 *
 * A seller account that reaches an operator URL is sent back to its own app;
 * the API would refuse the data anyway, but bouncing at the shell keeps the
 * two products from ever rendering into each other.
 */
export const OperatorLayout: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const dispatch = useDispatch();
  const [apiLogout] = useLogoutMutation();

  const { buildPath, localeNavigate, changeLocale } = useLocale();
  const { data: user, isLoading } = useGetMeQuery();
  const { t, i18n } = useTranslation(['translation', 'admin']);
  const { loadingState } = useUI();
  const { themeMode, toggleTheme } = useTheme();

  const pathWithoutLocale: string = stripLocaleFromPath(location.pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);

  /* Navigation closes the off-canvas sidebar at the source, so the shell needs
     no route-change effect to sync it. */
  const handleNavigate = useCallback(
    (path: string) => {
      setMobileSidebarOpen(false);
      localeNavigate(path);
    },
    [localeNavigate]
  );

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen((prev) => !prev);
    } else {
      setSidebarCollapsed((prev) => !prev);
    }
  }, []);

  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        await apiLogout().unwrap();
      } catch {
        // Still clear the local session even if the cookie clear fails
      }
      dispatch(logout());
      localeNavigate('/login');
      setIsLogoutConfirmOpen(false);
    })();
  }, [apiLogout, dispatch, localeNavigate]);

  const handleChangeLanguage = useCallback((lang: SupportedLocale) => changeLocale(lang), [changeLocale]);

  const navItems = useMemo<OperatorNavItem[]>(
    () =>
      resolveOperatorRoutes(user?.role).map((route) => ({
        path: route.path,
        labelKey: route.labelKey,
        icon: route.icon,
        isActive: pathWithoutLocale === route.path || pathWithoutLocale.startsWith(`${route.path}/`),
      })),
    [user?.role, pathWithoutLocale]
  );

  const breadcrumbItems = useMemo(
    () => resolveOperatorBreadcrumbs(pathWithoutLocale, user?.role, t),
    [pathWithoutLocale, user?.role, t]
  );

  const userName = user ? `${user.firstName} ${user.lastName}` : t('translation:common.notSet');

  if (!isAuthenticated) {
    return <Navigate to={buildPath('/login')} state={{ from: location }} replace />;
  }
  /* The role decides the whole shell, so nothing renders until it is known. */
  if (isLoading || !user) {
    return <div aria-busy="true" aria-live="polite" />;
  }
  if (!isOperatorRole(user.role)) {
    return <Navigate to={buildPath('/dashboard')} replace />;
  }

  return (
    <OperatorLayoutComponent
      user={user}
      userName={userName}
      navItems={navItems}
      breadcrumbItems={breadcrumbItems}
      sidebarCollapsed={sidebarCollapsed}
      mobileSidebarOpen={mobileSidebarOpen}
      isLogoutConfirmOpen={isLogoutConfirmOpen}
      loadingIsLoading={loadingState.isLoading}
      themeMode={themeMode}
      i18nLanguage={(i18n.language || 'en').split('-')[0]}
      onToggleSidebar={handleToggleSidebar}
      onNavigate={handleNavigate}
      onLocaleNavigate={handleNavigate}
      onChangeLanguage={handleChangeLanguage}
      onToggleTheme={toggleTheme}
      onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
      onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
      onCloseLogoutConfirm={() => setIsLogoutConfirmOpen(false)}
      onLogoutConfirm={handleLogout}
    />
  );
};

export default OperatorLayout;
