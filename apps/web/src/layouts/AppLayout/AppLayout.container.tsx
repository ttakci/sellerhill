import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useLocation } from 'react-router-dom';

import { AppLayout as AppLayoutComponent } from './AppLayout.component';

import { useGetMeQuery } from '@/features/auth/api/authApi';
import { logout, selectIsAuthenticated } from '@/features/auth/store/authSlice';
import { useLocale } from '@/utils/useLocale';

export const AppLayout: React.FC = () => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location = useLocation();
  const dispatch = useDispatch();

  const { buildPath } = useLocale();
  const { data: user } = useGetMeQuery();

  const handleLogout = () => {
    void dispatch(logout());
  };

  if (!isAuthenticated) {
    // Redirect to login but save the current location to redirect back after login
    return <Navigate to={buildPath('/login')} state={{ from: location }} replace />;
  }

  return <AppLayoutComponent user={user} onLogout={handleLogout} />;
};

export default AppLayout;
