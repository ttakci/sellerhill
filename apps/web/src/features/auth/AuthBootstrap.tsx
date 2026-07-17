import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useRefreshMutation } from './api/authApi';
import { selectAuthReady, setAuthReady, setCredentials, logout } from './store/authSlice';

/**
 * Restores session on app load using the HttpOnly refresh cookie.
 * Access tokens live only in memory — page reload always goes through refresh.
 */
export const AuthBootstrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useDispatch();
  const authReady = useSelector(selectAuthReady);
  const [refresh] = useRefreshMutation();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;

    void (async () => {
      try {
        const data = await refresh().unwrap();
        dispatch(setCredentials(data));
      } catch {
        dispatch(logout());
        dispatch(setAuthReady(true));
      }
    })();
  }, [dispatch, refresh]);

  if (!authReady) {
    // Minimal hold so protected routes don't flash-redirect to login
    return null;
  }

  return <>{children}</>;
};
