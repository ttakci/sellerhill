/**
 * LocaleRedirect Component
 *
 * Purpose: Redirects old routes without locale prefix to locale-aware routes.
 * Detects the user's preferred locale and redirects accordingly.
 *
 * e.g. /register -> /en/register or /tr/register
 */

import React, { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { buildLocalePath, resolveLocale } from './locale';

export interface LocaleRedirectProps {
  /** Target path without locale prefix (e.g. 'register') */
  to: string;
  /** Whether to preserve query params from current URL */
  preserveQuery?: boolean;
  /**
   * Whether to carry the URL fragment through the redirect. Off by default
   * because no app route used one; legal documents deep-link to a section
   * (e.g. /privacy#cookies) and would otherwise land at the top.
   */
  preserveHash?: boolean;
}

export const LocaleRedirect = ({
  to,
  preserveQuery = false,
  preserveHash = false,
}: LocaleRedirectProps): React.ReactElement => {
  const navigate = useNavigate();
  const { hash } = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const locale = resolveLocale();
    const path = buildLocalePath(`/${to}`, locale);
    const queryString = preserveQuery && searchParams.toString() ? `?${searchParams.toString()}` : '';
    const fragment = preserveHash ? hash : '';
    void navigate(`${path}${queryString}${fragment}`, { replace: true });
  }, [to, preserveQuery, preserveHash, hash, navigate, searchParams]);

  return <></>;
};
