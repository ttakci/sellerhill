/**
 * LanguageSwitcher — compact segmented EN | TR (or full locale names).
 * Presentational only; parent owns locale persistence / routing.
 */

import React from 'react';

import * as S from './LanguageSwitcher.style';
import type { LanguageSwitcherProps } from './LanguageSwitcher.types';

export const LanguageSwitcher = ({
  currentLocale,
  locales,
  onLocaleChange,
  variant = 'default',
  'aria-label': ariaLabel = 'Language',
}: LanguageSwitcherProps): React.ReactElement => {
  const label = (locale: (typeof locales)[number]) =>
    variant === 'compact' ? locale.code.toUpperCase() : locale.displayName;

  return (
    <S.Segmented role="group" aria-label={ariaLabel}>
      {locales.map((locale) => {
        const active = currentLocale === locale.code || currentLocale.startsWith(`${locale.code}-`);
        return (
          <S.Segment
            key={locale.code}
            type="button"
            $active={active}
            aria-pressed={active}
            disabled={active}
            title={locale.displayName}
            onClick={() => {
              if (!active) {
                onLocaleChange(locale.code);
              }
            }}
          >
            {label(locale)}
          </S.Segment>
        );
      })}
    </S.Segmented>
  );
};

LanguageSwitcher.displayName = 'LanguageSwitcher';
