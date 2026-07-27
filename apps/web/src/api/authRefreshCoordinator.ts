export interface AuthRefreshResult {
  accessToken: string | null;
  success: boolean;
}

export type RefreshSession = () => Promise<AuthRefreshResult>;

let refreshSession: RefreshSession | null = null;
let refreshPromise: Promise<AuthRefreshResult> | null = null;

export function configureAuthRefreshCoordinator(refresh: RefreshSession): void {
  refreshSession = refresh;
}

export function refreshAuthSession(): Promise<AuthRefreshResult> {
  if (!refreshSession) {
    return Promise.resolve({ accessToken: null, success: false });
  }

  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export function isAuthRefreshPending(): boolean {
  return refreshPromise !== null;
}
