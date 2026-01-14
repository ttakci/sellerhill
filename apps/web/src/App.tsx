import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import CheckEmailPage from './features/auth/CheckEmailPage';
import LoginPage from './features/auth/LoginPage';
import RegisterPage from './features/auth/RegisterPage';
import VerifyEmailPage from './features/auth/VerifyEmailPage';
import DashboardPage from './features/dashboard/DashboardPage';
import EbayConnectPage from './features/ebay/EbayConnectPage';
import OnboardingEbayPage from './features/ebay/OnboardingEbayPage';
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
          
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/register" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
