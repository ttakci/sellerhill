import {
  EntitlementState,
  isOperatorRole,
  ListingStatus,
  resolveEntitlementState,
  type SupportedLocale,
} from '@repo/shared';
import { getLocaleConfig, SIDEBAR_MOBILE_BREAKPOINT_PX, useUI } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import { AppLayout as AppLayoutComponent } from './AppLayout.component';

import { resolveHomePath } from '@/app/operatorRouting';
import { resolveBreadcrumbs } from '@/app/routeMeta';
import {
  ACTION_CENTER_POLL_INTERVAL_MS,
  useGetActionCenterQuery,
} from '@/features/action-center';
import { useGetMeQuery, useLogoutMutation } from '@/features/auth/api/authApi';
import { logout, selectIsAuthenticated } from '@/features/auth/store/authSlice';
import { useGetBillingSummaryQuery } from '@/features/billing/api/billing.api';
import { buildBillingUsageRows } from '@/features/billing/utils/usageRows';
import { stripLocaleFromPath } from '@/utils/locale';
import { useLocale } from '@/utils/useLocale';

/**
 * The only paths a suspended account may open.
 *
 * `/billing` is where the problem is fixed; `/settings` is read-mostly and
 * spends nothing, and a seller deciding which plan to buy may reasonably want
 * to look at what they have configured first.
 */
const SUSPENDED_ALLOWED_PATHS = ['/billing', '/settings'];

export const AppLayout: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const dispatch = useDispatch();
  const [apiLogout] = useLogoutMutation();

  const { buildPath } = useLocale();
  const { data: user, isLoading: isUserLoading } = useGetMeQuery();
  const { t, i18n } = useTranslation(['translation', 'listings', 'orders', 'billing']);
  const { loadingState } = useUI();
  const { localeNavigate, changeLocale } = useLocale();

  // Strip locale prefix for path comparisons
  const pathWithoutLocale: string = stripLocaleFromPath(location.pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  // Usage meters in the profile dropdown default to expanded — the whole point
  // is a glanceable shortcut — but collapse for anyone who wants a tidy menu.
  const [isProfileUsageOpen, setIsProfileUsageOpen] = useState(true);

  // Close mobile sidebar on route change
  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect */
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // The dedicated drafts view shares its path with the ordinary listings list
  // (`/listings/all`) and is distinguished only by its query string — so the
  // sidebar's own `pathWithoutLocale` isn't enough to tell them apart.
  const isDraftsActive =
    pathWithoutLocale === '/listings/all' &&
    new URLSearchParams(location.search).get('status') === ListingStatus.DRAFT;

  const handleToggleProfileUsage = useCallback(() => {
    setIsProfileUsageOpen((prev) => !prev);
  }, []);

  const userName = user ? `${user.firstName} ${user.lastName}` : t('translation:common.notSet');

  const handleToggleSidebar = useCallback(() => {
    if (window.innerWidth < SIDEBAR_MOBILE_BREAKPOINT_PX) {
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

  /*
   * Entitlement gate for the whole seller shell.
   *
   * A suspended account (payment failed, cancelled, or an expired trial) can
   * reach every screen but do almost nothing on them: creating a listing is
   * refused, price and stock updates have stopped, and orders are not being
   * purchased. Letting them wander produced the worst version of that — the
   * seller met a red error dialog on the one action they tried, with nothing
   * pointing at billing as the cause.
   *
   * Billing is the only screen that can resolve it, so that is where they go.
   */
  const { data: billingSummary } = useGetBillingSummaryQuery(undefined, {
    skip: !isAuthenticated || isOperatorRole(user?.role),
  });
  const isSuspended =
    Boolean(billingSummary?.enforcementEnabled) &&
    resolveEntitlementState(billingSummary?.subscription?.status ?? null) ===
      EntitlementState.SUSPENDED;

  /*
   * The same three meters the Billing page shows, surfaced in the profile
   * dropdown as a shortcut. `billingSummary` is already fetched above for the
   * suspension gate, so this costs no extra request; the shared builder keeps
   * the figures identical to the Billing page's own list.
   */
  const billingUsageRows = useMemo(
    () => buildBillingUsageRows(billingSummary, t, getLocaleConfig(i18n.language).locale),
    [billingSummary, t, i18n.language],
  );
  // Same key the Billing page renders — one label catalog, no drift.
  const billingPlanSlug = billingSummary?.plan?.slug ?? null;
  const billingPlanName = billingPlanSlug
    ? t(`billing:billing.plans.${billingPlanSlug}.name`)
    : null;

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
  /*
   * Redirect only from OTHER pages — billing itself must stay reachable, or the
   * seller is bounced away from the one screen that can fix the problem.
   */
  if (
    isSuspended &&
    !SUSPENDED_ALLOWED_PATHS.some((allowed) => pathWithoutLocale.startsWith(allowed))
  ) {
    return <Navigate to={buildPath('/billing')} replace />;
  }

  return (
    <AppLayoutComponent
      user={user}
      onLogout={handleLogout}
      sidebarCollapsed={sidebarCollapsed}
      mobileSidebarOpen={mobileSidebarOpen}
      isLogoutConfirmOpen={isLogoutConfirmOpen}
      pathWithoutLocale={pathWithoutLocale}
      isDraftsActive={isDraftsActive}
      userName={userName}
      loadingIsLoading={loadingState.isLoading}
      breadcrumbItems={breadcrumbItems}
      onToggleSidebar={handleToggleSidebar}
      onNavigate={handleNavigate}
      onLogoutConfirm={handleLogout}
      onChangeLanguage={handleChangeLanguage}
      onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
      onOpenLogoutConfirm={() => setIsLogoutConfirmOpen(true)}
      onCloseLogoutConfirm={() => setIsLogoutConfirmOpen(false)}
      onLocaleNavigate={localeNavigate}
      pendingActionCount={actionCenter?.totalCount ?? 0}
      hasCriticalActions={(actionCenter?.criticalCount ?? 0) > 0}
      billingUsageRows={billingUsageRows}
      billingPlanName={billingPlanName}
      isProfileUsageOpen={isProfileUsageOpen}
      onToggleProfileUsage={handleToggleProfileUsage}
      i18nLanguage={(i18n.language || 'en').split('-')[0]}
    />
  );
};

export default AppLayout;
