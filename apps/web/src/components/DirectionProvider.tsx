import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { isRtlLocale } from '@repo/shared';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import rtlPlugin from 'stylis-plugin-rtl';

import type { DirectionProviderProps } from './DirectionProvider.types';

/**
 * One Emotion cache per direction, created once at module load. The RTL cache
 * runs every stylesheet through `stylis-plugin-rtl`, which mirrors the physical
 * properties (margin-left, padding-right, left/right, border-radius corners,
 * text-align…) the whole design system is written in — so Arabic and Urdu get a
 * mirrored layout without a second stylesheet or a rewrite to logical
 * properties. A rule that must NOT flip (a chart axis, a code block) opts out
 * with a `/* @noflip *\/` comment.
 *
 * The two caches need distinct keys: Emotion keys its injected `<style>` tags
 * by cache key, so sharing one would let the LTR and RTL rules overwrite each
 * other when the language changes at runtime.
 */
const ltrCache = createCache({ key: 'sh' });
const rtlCache = createCache({ key: 'sh-rtl', stylisPlugins: [rtlPlugin] });

/**
 * Keeps `<html lang dir>` and the Emotion cache in step with the active i18n
 * language. `dir` on the root is what flips the browser's own behaviour
 * (scrollbar side, form-control alignment, text bidi); the cache flips ours.
 */
export const DirectionProvider = ({ children }: DirectionProviderProps): React.ReactElement => {
  const { i18n } = useTranslation();
  const language = (i18n.language || 'en').split('-')[0];
  const isRtl = isRtlLocale(language);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = isRtl ? 'rtl' : 'ltr';
  }, [language, isRtl]);

  return <CacheProvider value={isRtl ? rtlCache : ltrCache}>{children}</CacheProvider>;
};
