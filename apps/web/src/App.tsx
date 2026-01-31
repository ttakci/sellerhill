import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import CheckEmailPage from './features/auth/check-email';
import LoginPage from './features/auth/login';
import RegisterPage from './features/auth/register';
import VerifyEmailPage from './features/auth/verify-email';
import DashboardPage from './features/dashboard/DashboardPage';
import EbayConnectPage from './features/ebay/ebay-connect';
import OnboardingEbayPage from './features/ebay/onboarding';
import { ListingSettingsGroupForm, ListingSettingsGroupPage } from './features/listing-settings-groups';
import {
  AddListingsPage,
  ListingJobDetailsPage,
  ListingJobsPage,
  ListingsPage,
  ProductsPage,
} from './features/listings';
import { OrdersPage } from './features/orders/OrdersPage.container';
import { OrderDetailsPage } from './features/orders/details';
import ProfilePage from './features/profile';
import StoreSettingsPage from './features/store-settings';
import { AppLayout } from './layouts/AppLayout';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/check-email" element={<CheckEmailPage />} />

        {/* Protected routes with layout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ebay/connect" element={<EbayConnectPage />} />
          <Route path="/onboarding/ebay" element={<OnboardingEbayPage />} />
          <Route path="/settings/store" element={<StoreSettingsPage />} />
          <Route path="/settings/listing-groups" element={<ListingSettingsGroupPage />} />
          <Route path="/settings/listing-groups/new" element={<ListingSettingsGroupForm />} />
          <Route path="/settings/listing-groups/:id/edit" element={<ListingSettingsGroupForm />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listings/jobs" element={<ListingJobsPage />} />
          <Route path="/listings/jobs/:jobId" element={<ListingJobDetailsPage />} />
          <Route path="/listings/products" element={<ProductsPage />} />
          <Route path="/listings/add" element={<AddListingsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrderDetailsPage />} />
          <Route path="/profile" element={<ProfilePage />} />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/register" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
