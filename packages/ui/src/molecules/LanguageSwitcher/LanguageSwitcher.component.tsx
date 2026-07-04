/**
 * LanguageSwitcher Component
 *
 * Purpose: Display a language toggle/selector for switching between supported locales.
 * Pure presentation component — locale change logic is handled by the parent container.
 *
 * Visual: a compact "segmented control" — a single frosted track containing one segment
 * per locale, with the active segment elevated (surface + shadow). This keeps it visually
 * consistent with the ThemeToggle icon button it usually sits next to.
 */

import styled from '@emotion/styled';
import React from 'react';

import { tkn } from '../../theme/tkn';

import type { LanguageSwitcherProps } from './LanguageSwitcher.types';

const Segmented = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')};
  background: color-mix(in srgb, ${tkn('colors.surface.primary')} 55%, transparent);
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  backdrop-filter: blur(8px);
`;

const Segment = styled.button<{ $active?: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-size: ${tkn('typography.fontSize.xs')};
  letter-spacing: ${tkn('typography.letterSpacing.wide')};
  line-height: 1;
  height: 1.75rem; /* 28px */
  min-width: 2.25rem;
  padding: 0 0.625rem;
  border-radius: ${tkn('radius.sm')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ $active }) => ($active ? tkn('colors.text.primary') : tkn('colors.text.tertiary'))};
  background: ${({ $active }) => ($active ? tkn('colors.surface.primary') : 'transparent')};
  font-weight: ${({ $active }) => ($active ? 600 : 500)};
  box-shadow: ${({ $active }) => ($active ? tkn('shadows.sm') : 'none')};
  transition:
    background 150ms ease,
    color 150ms ease,
    box-shadow 150ms ease;

  &:hover {
    color: ${tkn('colors.text.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
    outline-offset: 1px;
  }
`;

export const LanguageSwitcher = ({
  currentLocale,
  locales,
  onLocaleChange,
  variant = 'default',
}: LanguageSwitcherProps): React.ReactElement => {
  const label = (locale: (typeof locales)[number]) =>
    variant === 'compact' ? locale.code.toUpperCase() : locale.displayName;

  return (
    <Segmented role="group" aria-label="Language">
      {locales.map((locale) => (
        <Segment
          key={locale.code}
          type="button"
          $active={currentLocale === locale.code}
          aria-pressed={currentLocale === locale.code}
          onClick={() => onLocaleChange(locale.code)}
        >
          {label(locale)}
        </Segment>
      ))}
    </Segmented>
  );
};
