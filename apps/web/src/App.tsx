import { lazy, Suspense, type ReactElement, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import LandingPage from './features/landing';
import { AppLayout } from './layouts/AppLayout';
import { LocaleRedirect } from './utils/LocaleRedirect';

/** Lightweight route fallback — avoids global overlay for navigation. */
function RouteFallback(): ReactElement {
  return <div aria-busy="true" aria-live="polite" />;
}

function Lazy({ children }: { children: ReactNode }): ReactElement {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

// Public auth (small) — still lazy to keep initial landing bundle lean
const CheckEmailPage = lazy(() => import('./features/auth/check-email'));
const LoginPage = lazy(() => import('./features/auth/login'));
const RegisterPage = lazy(() => import('./features/auth/register'));
const VerifyEmailPage = lazy(() => import('./features/auth/verify-email'));

// App shell pages
const AdminPage = lazy(() => import('./features/admin/AdminPage'));
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
const OrdersOverviewPage = lazy(() =>
  import('./features/orders').then((m) => ({ default: m.OrdersOverviewPage }))
);
const OrdersAllPage = lazy(() =>
  import('./features/orders').then((m) => ({ default: m.OrdersAllPage }))
);
const SettingsHubPage = lazy(() =>
  import('./features/settings/SettingsPage').then((m) => ({ default: m.SettingsHubPage }))
);
const SupportPage = lazy(() => import('./features/support/SupportPage'));

export function App() {
  return (
    <BrowserRouter>
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
              path="admin"
              element={
                <Lazy>
                  <AdminPage />
                </Lazy>
              }
            />
            <Route
              path="settings"
              element={
                <Lazy>
                  <SettingsHubPage />
                </Lazy>
              }
            />
            {/* Legacy full-page settings routes → hub (drawers cover all edit flows) */}
            <Route path="settings/store" element={<Navigate to=".." relative="path" replace />} />
            <Route path="settings/amazon-accounts" element={<Navigate to=".." relative="path" replace />} />
            <Route path="settings/listing-groups" element={<Navigate to=".." relative="path" replace />} />

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
                  <OrdersOverviewPage />
                </Lazy>
              }
            />
            <Route
              path="orders/all"
              element={
                <Lazy>
                  <OrdersAllPage />
                </Lazy>
              }
            />
            <Route
              path="orders/:id"
              element={
                <Lazy>
                  <OrderDetailsPage />
                </Lazy>
              }
            />
            <Route path="support" element={<Lazy><SupportPage /></Lazy>} />
            {/* Folded into the /admin panel (Overview tab) — kept as a redirect for old links. */}
            <Route path="admin/assistant" element={<Navigate to="../admin" replace />} />
            <Route path="profile" element={<Navigate to="../settings" replace />} />
            <Route index element={<Navigate to="register" replace />} />
          </Route>
        </Route>

        {/* Redirect old routes without locale to locale-aware routes */}
        <Route path="/register" element={<LocaleRedirect to="register" />} />
        <Route path="/login" element={<LocaleRedirect to="login" />} />
        <Route path="/verify-email" element={<LocaleRedirect to="verify-email" preserveQuery />} />
        <Route path="/auth/check-email" element={<LocaleRedirect to="auth/check-email" preserveQuery />} />
        <Route path="/dashboard" element={<LocaleRedirect to="dashboard" preserveQuery />} />
        <Route path="/stores" element={<LocaleRedirect to="stores" preserveQuery />} />
        <Route path="/ebay/callback" element={<LocaleRedirect to="settings" />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
