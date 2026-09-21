import { configureStore, type Middleware } from '@reduxjs/toolkit';

import { configureAuthRefresh } from '@/api/authRefreshBootstrap';
import { baseApi } from '@/api/baseApi';
import authReducer from '@/features/auth/store/authSlice';

interface AuthUserState {
  auth?: { user?: { id?: string } | null };
}

/**
 * RTK Query keeps its cache in memory for the life of the page and keys it by
 * request arguments only — not by who is signed in. Signing out and back in as
 * another account in the same tab therefore kept serving the PREVIOUS
 * account's billing summary (and every other cached read) until each query
 * happened to refetch. Observed 2026-09-21: a brand-new account showed the
 * previous account's "trial ended". Whenever the signed-in user changes —
 * including to nobody, i.e. logout — the whole API cache is dropped. A token
 * refresh keeps the same user id, so it never triggers this.
 */
const resetApiCacheOnUserChange: Middleware = (api) => (next) => (action) => {
  const before = (api.getState() as AuthUserState).auth?.user?.id ?? null;
  const result = next(action);
  const after = (api.getState() as AuthUserState).auth?.user?.id ?? null;
  if (before !== after) {
    api.dispatch(baseApi.util.resetApiState());
  }
  return result;
};

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
  },
  middleware: (gdm) => gdm().concat(baseApi.middleware, resetApiCacheOnUserChange),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

configureAuthRefresh(store.dispatch, () => store.getState());
