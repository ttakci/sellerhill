import type { CookieOptions, Response } from 'express';

/** Cookie name for the long-lived refresh JWT (HttpOnly — never readable by JS). */
export const REFRESH_COOKIE_NAME = 'zonds_rt';

/** 7 days in seconds — keep in sync with AUTH_CONSTANTS.JWT_REFRESH_TOKEN_EXPIRES_IN */
const REFRESH_MAX_AGE_SEC = 7 * 24 * 60 * 60;

/**
 * Cookie options for the refresh token.
 *
 * Env (optional):
 * - COOKIE_DOMAIN=.takci.cloud  → share cookie across FE/API subdomains
 * - COOKIE_SAMESITE=lax|strict|none  (default: lax; use none when FE host ≠ API host)
 *
 * When SameSite=None, Secure is forced (browser requirement).
 */
function cookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  const sameSiteEnv = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite = (['lax', 'strict', 'none'].includes(sameSiteEnv)
    ? sameSiteEnv
    : 'lax') as 'lax' | 'strict' | 'none';
  const secure = isProd || sameSite === 'none';

  const options: CookieOptions = {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api',
    maxAge: REFRESH_MAX_AGE_SEC * 1000,
  };

  // e.g. COOKIE_DOMAIN=.takci.cloud so app.takci.cloud + zonds.takci.cloud share the cookie
  if (process.env.COOKIE_DOMAIN?.trim()) {
    options.domain = process.env.COOKIE_DOMAIN.trim();
  }

  return options;
}

export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, cookieOptions());
}

export function clearRefreshTokenCookie(res: Response): void {
  const opts = cookieOptions();
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
    domain: opts.domain,
  });
}
