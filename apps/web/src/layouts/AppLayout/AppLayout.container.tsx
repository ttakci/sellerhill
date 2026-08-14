import { isOperatorRole, type SupportedLocale } from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import { AppLayout as AppLayoutComponent } from './AppLayout.component';

import { resolveHomePath } from '@/app/operatorRouting';
import { resolveBreadcrumbs, resolveNavSection } from '@/app/routeMeta';
import {
  ACTION_CENTER_POLL_INTERVAL_MS,
  useGetActionCenterQuery,
} from '@/features/action-center';
import { useGetMeQuery, useLogoutMutation } from '@/features/auth/api/authApi';
import { logout, selectIsAuthenticated } from '@/features/auth/store/authSlice';
import { stripLocaleFromPath } from '@/utils/locale';
import { useLocale } from '@/utils/useLocale';

export const AppLayout: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const dispatch = useDispatch();
  const [apiLogout] = useLogoutMutation();

  const { buildPath } = useLocale();
  const { data: user, isLoading: isUserLoading } = useGetMeQuery();
  const { t, i18n } = useTranslation(['translation', 'listings', 'orders']);
  const { loadingState } = useUI();
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

    const section = resolveNavSection(pathWithoutLocale);
    setOpenSections((prev) => ({
      inventory: section === 'inventory' ? true : prev.inventory,
      configuration: section === 'configuration' ? true : prev.configuration,
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
    void (async () => {
      try {
        await apiLogout().unwrap();
      } catch {
        // Still clear local session even if cookie clear fails
      }
      dispatch(logout());
      localeNavigate('/login');
      setIsLogoutConfirmOpen(false);
    })();
  }, [apiLogout, dispatch, localeNavigate]);

  const handleChangeLanguage = useCallback(
    (lang: SupportedLocale) => {
      changeLocale(lang);
    },
    [changeLocale]
  );

  const breadcrumbItems = useMemo(
    () => resolveBreadcrumbs(pathWithoutLocale, t),
    [pathWithoutLocale, t]
  );

  /*
   * The nav badge is the whole point of the Action Center: it is what makes a
   * blocked purchase discoverable without already suspecting it. Polling lives
   * here rather than on the page so the count keeps updating while the seller
   * is anywhere in the app.
   *
   * `skip` while unauthenticated — the shell renders a redirect below in that
   * case, and firing an authenticated request first would be a guaranteed 401.
   */
  const { data: actionCenter } = useGetActionCenterQuery(undefined, {
    skip: !isAuthenticated || isOperatorRole(user?.role),
    pollingInterval: ACTION_CENTER_POLL_INTERVAL_MS,
  });

  if (!isAuthenticated) {
    return <Navigate to={buildPath('/login')} state={{ from: location }} replace />;
  }
  /*
   * Staff accounts belong to the operator console. Bouncing them here means a
   * stale bookmark or an old link cannot render the seller shell around empty
   * data — every seller endpoint answers 403 for these roles.
   */
  if (!isUserLoading && isOperatorRole(user?.role)) {
    return <Navigate to={buildPath(resolveHomePath(user?.role, false))} replace />;
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
      breadcrumbItems={breadcrumbItems}
      openSections={openSections}
      onToggleSidebar={handleToggleSidebar}
      onNavigate={handleNavigate}
      onLogoutConfirm={handleLogout}
      onChangeLanguage={handleChangeLanguage}
      onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
      onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
      onCloseLogoutConfirm={() => setIsLogoutConfirmOpen(false)}
      onLocaleNavigate={localeNavigate}
      onToggleSection={handleToggleSection}
      pendingActionCount={actionCenter?.totalCount ?? 0}
      hasCriticalActions={(actionCenter?.criticalCount ?? 0) > 0}
      i18nLanguage={(i18n.language || 'en').split('-')[0]}
    />
  );
};

export default AppLayout;
