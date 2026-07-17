import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { UserDto } from '@repo/shared';

/**
 * Auth state — tokens are NOT persisted to localStorage.
 * - accessToken: memory only (Redux) — short-lived; rehydrated via refresh cookie
 * - refresh token: HttpOnly cookie set by API (JS cannot read it)
 */
interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  /** False until silent session restore (cookie refresh) finishes. */
  authReady: boolean;
}

/** Purge legacy XSS-vulnerable keys from older builds. */
function purgeLegacyTokenStorage(): void {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {
    // ignore
  }
}

purgeLegacyTokenStorage();

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  authReady: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      {
        payload: { user, accessToken },
      }: PayloadAction<{ user: UserDto; accessToken: string; refreshToken?: string }>
    ) => {
      state.user = user;
      state.accessToken = accessToken;
      state.isAuthenticated = true;
      state.authReady = true;
      // refreshToken deliberately ignored — lives in HttpOnly cookie only
    },
    setAuthReady: (state, action: PayloadAction<boolean>) => {
      state.authReady = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.authReady = true;
      purgeLegacyTokenStorage();
    },
  },
});

export const { setCredentials, setAuthReady, logout } = authSlice.actions;

export default authSlice.reducer;

export const selectCurrentUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthReady = (state: { auth: AuthState }) => state.auth.authReady;
