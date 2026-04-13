import React from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import { AppLayout as AppLayoutComponent } from './AppLayout.component';

import { selectIsAuthenticated } from '@/features/auth/store/authSlice';

export const AppLayout: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    // Redirect to login but save the current location to redirect back after login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <AppLayoutComponent />;
};

export default AppLayout;
