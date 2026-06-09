/**
 * LocaleRedirect Component
 *
 * Purpose: Redirects old routes without locale prefix to locale-aware routes.
 * Detects the user's preferred locale and redirects accordingly.
 *
 * e.g. /register -> /en/register or /tr/register
 */

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { buildLocalePath, resolveLocale } from './locale';

export interface LocaleRedirectProps {
  /** Target path without locale prefix (e.g. 'register') */
  to: string;
  /** Whether to preserve query params from current URL */
  preserveQuery?: boolean;
}

export const LocaleRedirect = ({ to, preserveQuery = false }: LocaleRedirectProps): React.ReactElement => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const locale = resolveLocale();
    const path = buildLocalePath(`/${to}`, locale);
    const queryString = preserveQuery && searchParams.toString() ? `?${searchParams.toString()}` : '';
    void navigate(`${path}${queryString}`, { replace: true });
  }, [to, preserveQuery, navigate, searchParams]);

  return <></>;
};
