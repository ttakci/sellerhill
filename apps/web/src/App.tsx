import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AmazonAccountsPageContainer } from './features/amazon/accounts/AmazonAccountsPage.container';
import CheckEmailPage from './features/auth/check-email';
import LoginPage from './features/auth/login';
import RegisterPage from './features/auth/register';
import VerifyEmailPage from './features/auth/verify-email';
import DashboardPage from './features/dashboard/DashboardPage';
import OnboardingEbayPage from './features/ebay/onboarding';
import StoresPage from './features/ebay/stores';
import LandingPage from './features/landing';
import { ListingSettingsGroupPage } from './features/listing-settings-groups';
import {
  AddListingsPage,
  ListingJobDetailsPage,
  ListingJobsPage,
  ListingsPage,
  ProductsPage,
} from './features/listings';
import { OrderDetailsPage } from './features/orders/details';
import { OrdersPage } from './features/orders/OrdersPage.container';
import { SettingsHubPage } from './features/settings/SettingsPage';
import StoreSettingsPage from './features/store-settings';
import { AppLayout } from './layouts/AppLayout';
import { LocaleRedirect } from './utils/LocaleRedirect';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing page (no locale prefix) */}
        <Route path="/" element={<LandingPage />} />

        {/* Locale-prefixed routes */}
        <Route path="/:locale">
          {/* Public routes */}
          <Route path="register" element={<RegisterPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="auth/check-email" element={<CheckEmailPage />} />

          {/* Protected routes with layout */}
          <Route element={<AppLayout />}>
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="stores" element={<StoresPage />} />
            <Route path="onboarding/ebay" element={<OnboardingEbayPage />} />

            {/* Settings hub (new consolidated) */}
            <Route path="settings" element={<SettingsHubPage />} />
            {/* Legacy settings routes — kept for deep-link compatibility (edit forms still useful) */}
            <Route path="settings/store" element={<StoreSettingsPage />} />
            <Route path="settings/amazon-accounts" element={<AmazonAccountsPageContainer />} />
            <Route path="settings/listing-groups" element={<ListingSettingsGroupPage />} />

            <Route path="listings" element={<ListingsPage />} />
            <Route path="listings/jobs" element={<ListingJobsPage />} />
            <Route path="listings/jobs/:jobId" element={<ListingJobDetailsPage />} />
            <Route path="listings/products" element={<ProductsPage />} />
            <Route path="listings/add" element={<AddListingsPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="orders/:id" element={<OrderDetailsPage />} />
            {/* Profile route redirects to settings hub */}
            <Route path="profile" element={<Navigate to="../settings" replace />} />

            {/* Default redirect within locale */}
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

        {/* Catch-all: redirect to landing */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
