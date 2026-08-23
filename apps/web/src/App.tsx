import { lazy, Suspense, type ReactElement, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';

import { DemoBanner } from './features/demo';
import LandingPage from './features/landing';
import { AppLayout } from './layouts/AppLayout';
import { OperatorLayout } from './layouts/OperatorLayout';
import { LocaleRedirect } from './utils/LocaleRedirect';

/** Lightweight route fallback — avoids global overlay for navigation. */
function RouteFallback(): ReactElement {
  return <div aria-busy="true" aria-live="polite" />;
}

function Lazy({ children }: { children: ReactNode }): ReactElement {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

/**
 * Legacy child path that folded into its parent. Keeps the query string, so a
 * bookmarked `/orders/all?dateFrom=…` still lands on the filtered list.
 */
function RedirectToParent(): ReactElement {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '..', search }} relative="path" replace />;
}

/**
 * Billing moved out of the Settings drawer stack onto its own route
 * (`/:locale/billing`). `?drawer=billing` used to open it as a drawer over
 * `/settings` — this still needs to resolve for old bookmarks/links, so the
 * settings route checks for it and redirects to the canonical page instead of
 * rendering (silently) nothing.
 */
function SettingsRoute({ children }: { children: ReactNode }): ReactElement {
  const [searchParams] = useSearchParams();
  if (searchParams.get('drawer') === 'billing') {
    return <Navigate to="../billing" relative="path" replace />;
  }
  return <>{children}</>;
}

// Public auth (small) — still lazy to keep initial landing bundle lean
const CheckEmailPage = lazy(() => import('./features/auth/check-email'));
const LoginPage = lazy(() => import('./features/auth/login'));
const RegisterPage = lazy(() => import('./features/auth/register'));
const VerifyEmailPage = lazy(() => import('./features/auth/verify-email'));

// App shell pages
const ActionCenterPage = lazy(() =>
  import('./features/action-center').then((m) => ({ default: m.ActionCenterPageContainer }))
);
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
const BillingPage = lazy(() => import('./features/billing').then((m) => ({ default: m.BillingPage })));
const DashboardPage = lazy(() => import('./features/dashboard/DashboardPage'));
const OnboardingEbayPage = lazy(() => import('./features/ebay/onboarding'));
const StoresPage = lazy(() => import('./features/ebay/stores'));
const ListingJobDetailsPage = lazy(() =>
  import('./features/listings').then((m) => ({ default: m.ListingJobDetailsPage }))
);
const ListingJobsPage = lazy(() =>
  import('./features/listings').then((m) => ({ default: m.ListingJobsPage }))
);
const ListingsAllPage = lazy(() =>
  import('./features/listings').then((m) => ({ default: m.ListingsAllPage }))
);
const ProductsPage = lazy(() =>
  import('./features/listings').then((m) => ({ default: m.ProductsPage }))
);
const ListingOverviewPage = lazy(() =>
  import('./features/listings').then((m) => ({ default: m.ListingOverviewPage }))
);
const ListingDetailPage = lazy(() =>
  import('./features/listings').then((m) => ({ default: m.ListingDetailPage }))
);
const OrderDetailsPage = lazy(() =>
  import('./features/orders').then((m) => ({ default: m.OrderDetailsPage }))
);
const OrdersAllPage = lazy(() =>
  import('./features/orders').then((m) => ({ default: m.OrdersAllPage }))
);
const SettingsHubPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsHubPage }))
);

export function App() {
  return (
    <BrowserRouter>
      {/* Renders nothing unless this document was opened as a demo. */}
      <DemoBanner />
      <Routes>
        {/* Landing page (no locale prefix) — eager for first paint */}
        <Route path="/" element={<LandingPage />} />

        {/* Locale-prefixed routes */}
        <Route path="/:locale">
          {/* Public routes */}
          <Route
            path="register"
            element={
              <Lazy>
                <RegisterPage />
              </Lazy>
            }
          />
          <Route
            path="login"
            element={
              <Lazy>
                <LoginPage />
              </Lazy>
            }
          />
          <Route
            path="verify-email"
            element={
              <Lazy>
                <VerifyEmailPage />
              </Lazy>
            }
          />
          <Route
            path="auth/check-email"
            element={
              <Lazy>
                <CheckEmailPage />
              </Lazy>
            }
          />

          {/* Protected routes with layout */}
          <Route element={<AppLayout />}>
            <Route
              path="dashboard"
              element={
                <Lazy>
                  <DashboardPage />
                </Lazy>
              }
            />
            <Route
              path="actions"
              element={
                <Lazy>
                  <ActionCenterPage />
                </Lazy>
              }
            />
            <Route
              path="stores"
              element={
                <Lazy>
                  <StoresPage />
                </Lazy>
              }
            />
            <Route
              path="onboarding/ebay"
              element={
                <Lazy>
                  <OnboardingEbayPage />
                </Lazy>
              }
            />

            <Route
              path="settings"
              element={
                <SettingsRoute>
                  <Lazy>
                    <SettingsHubPage />
                  </Lazy>
                </SettingsRoute>
              }
            />
            {/* Legacy full-page settings routes → hub (drawers cover all edit flows) */}
            <Route path="settings/store" element={<Navigate to=".." relative="path" replace />} />
            <Route path="settings/amazon-accounts" element={<Navigate to=".." relative="path" replace />} />
            <Route path="settings/listing-groups" element={<Navigate to=".." relative="path" replace />} />
            {/* Billing moved out of Settings onto its own route — see SettingsRoute above. */}
            <Route path="settings/billing" element={<Navigate to="../billing" relative="path" replace />} />
            <Route
              path="billing"
              element={
                <Lazy>
                  <BillingPage />
                </Lazy>
              }
            />

            <Route
              path="listings"
              element={
                <Lazy>
                  <ListingOverviewPage />
                </Lazy>
              }
            />
            <Route
              path="listings/all"
              element={
                <Lazy>
                  <ListingsAllPage />
                </Lazy>
              }
            />
            <Route
              path="listings/jobs"
              element={
                <Lazy>
                  <ListingJobsPage />
                </Lazy>
              }
            />
            <Route
              path="listings/jobs/:jobId"
              element={
                <Lazy>
                  <ListingJobDetailsPage />
                </Lazy>
              }
            />
            <Route
              path="listings/products"
              element={
                <Lazy>
                  <ProductsPage />
                </Lazy>
              }
            />
            {/*
              One canonical create flow. `/listings/add` used to render a second,
              independently-built full page over the same Zod schema as the
              drawer — different radius, different typography compliance, and two
              code paths to keep in sync. It now redirects into the drawer, the
              same way the legacy settings pages redirect to the settings hub.
            */}
            <Route
              path="listings/add"
              element={<Navigate to={{ pathname: '..', search: '?drawer=add' }} relative="path" replace />}
            />
            <Route
              path="listings/:listingId"
              element={
                <Lazy>
                  <ListingDetailPage />
                </Lazy>
              }
            />
            <Route
              path="orders"
              element={
                <Lazy>
                  <OrdersAllPage />
                </Lazy>
              }
            />
            {/* Folded into `/orders`: the overview carried no action of its own. */}
            <Route path="orders/all" element={<RedirectToParent />} />
            <Route
              path="orders/:id"
              element={
                <Lazy>
                  <OrderDetailsPage />
                </Lazy>
              }
            />
            <Route path="profile" element={<Navigate to="../settings" replace />} />
            <Route index element={<Navigate to="register" replace />} />
          </Route>

          {/*
            Operator console — a separate shell, not a section of the seller
            app. Staff accounts (ADMIN) live here and nowhere else; the API
            refuses seller surfaces for them, and `OperatorLayout` bounces a
            customer that reaches these URLs.

            The `/support` console (SUPPORT role queue/claim/reply/presence)
            was removed 2026-08 when customer support moved to tawk.to, which
            has its own agent dashboard outside SellerHill — see CLAUDE.md
            "Customer support widget — tawk.to".
          */}
          <Route element={<OperatorLayout />}>
            <Route
              path="admin"
              element={
                <Lazy>
                  <AdminPage />
                </Lazy>
              }
            />
            {/* Folded into the /admin panel (Overview tab) — kept as a redirect for old links. */}
            <Route path="admin/assistant" element={<Navigate to="../admin" replace />} />
          </Route>
        </Route>

        {/* Redirect old routes without locale to locale-aware routes */}
        <Route path="/register" element={<LocaleRedirect to="register" />} />
        <Route path="/login" element={<LocaleRedirect to="login" />} />
        <Route path="/verify-email" element={<LocaleRedirect to="verify-email" preserveQuery />} />
        <Route path="/auth/check-email" element={<LocaleRedirect to="auth/check-email" preserveQuery />} />
        <Route path="/dashboard" element={<LocaleRedirect to="dashboard" preserveQuery />} />
        <Route path="/actions" element={<LocaleRedirect to="actions" preserveQuery />} />
        <Route path="/stores" element={<LocaleRedirect to="stores" preserveQuery />} />
        <Route path="/ebay/callback" element={<LocaleRedirect to="settings" />} />
        {/*
         * Stripe's checkout success_url / cancel_url / portal return_url
         * (billing-provider.ts) are built as `${FRONTEND_URL}/billing?...` with
         * no locale segment — the backend has no reliable way to know which
         * locale the seller was on when checkout started. Without this route,
         * "billing" itself gets matched as the `:locale` param below, landing on
         * that route's empty `index` redirect (-> "register"), so a completed
         * Stripe checkout bounced to /billing/register instead of back to the
         * billing page. preserveQuery carries checkout=success/session_id
         * (and topup=success/cancelled) through so they aren't silently
         * dropped by the redirect — BillingPage does not currently read
         * either param itself; it re-fetches the summary/details on mount,
         * which is what actually reflects a completed checkout or top-up.
         */}
        <Route path="/billing" element={<LocaleRedirect to="billing" preserveQuery />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
