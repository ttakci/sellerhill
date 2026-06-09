/**
 * LanguageSwitcher Component
 *
 * Purpose: Display a language toggle/selector for switching between supported locales.
 * Pure presentation component — locale change logic is handled by the parent container.
 */

import styled from '@emotion/styled';
import React from 'react';

import { tkn } from '../../theme/tkn';

import type { LanguageSwitcherProps } from './LanguageSwitcher.types';

const SwitcherContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

const LangButton = styled.button<{ $active?: boolean }>`
  font-size: 0.8125rem;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.border.secondary'))};
  background: ${({ $active }) => ($active ? tkn('colors.semanticTint.info') : 'transparent')};
  color: ${({ $active }) => ($active ? tkn('colors.brand.primary') : tkn('colors.text.secondary'))};
  font-weight: ${({ $active }) => ($active ? 600 : 400)};
  min-width: 2.5rem;
  cursor: pointer;
  transition: all 0.15s ease;
  font-family: inherit;

  &:hover {
    background: ${({ $active }) => ($active ? tkn('colors.semanticTint.info') : tkn('colors.background.tertiary'))};
  }
`;

const Divider = styled.span`
  color: ${tkn('colors.text.tertiary')};
  font-size: 0.75rem;
  user-select: none;
`;

export const LanguageSwitcher = ({
  currentLocale,
  locales,
  onLocaleChange,
  variant = 'default',
}: LanguageSwitcherProps): React.ReactElement => {
  if (variant === 'compact') {
    return (
      <SwitcherContainer>
        {locales.map((locale, index) => (
          <React.Fragment key={locale.code}>
            {index > 0 && <Divider>|</Divider>}
            <LangButton
              type="button"
              $active={currentLocale === locale.code}
              onClick={() => onLocaleChange(locale.code)}
            >
              {locale.code.toUpperCase()}
            </LangButton>
          </React.Fragment>
        ))}
      </SwitcherContainer>
    );
  }

  return (
    <SwitcherContainer>
      {locales.map((locale, index) => (
        <React.Fragment key={locale.code}>
          {index > 0 && <Divider>|</Divider>}
          <LangButton type="button" $active={currentLocale === locale.code} onClick={() => onLocaleChange(locale.code)}>
            {locale.displayName}
          </LangButton>
        </React.Fragment>
      ))}
    </SwitcherContainer>
  );
};
