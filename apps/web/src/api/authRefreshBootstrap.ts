import type { AuthResponse } from '@repo/shared';

import { configureAuthRefreshCoordinator } from './authRefreshCoordinator';

import type { AppDispatch, RootState } from '@/app/store';
import { logout, setCredentials } from '@/features/auth/store/authSlice';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export function configureAuthRefresh(dispatch: AppDispatch, getState: () => RootState): void {
  configureAuthRefreshCoordinator(async () => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    if (!response.ok) {
      dispatch(logout());
      return { accessToken: null, success: false };
    }

    const session = (await response.json()) as AuthResponse;
    dispatch(setCredentials(session));
    return { accessToken: getState().auth.accessToken, success: true };
  });
}
