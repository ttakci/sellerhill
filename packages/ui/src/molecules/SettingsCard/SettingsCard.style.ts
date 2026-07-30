import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import { SettingsCardVariant } from './SettingsCard.types';

export const CardContainer = styled.div<{ $variant: SettingsCardVariant }>`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
`;

export const CardHeader = styled.div<{ $variant: SettingsCardVariant }>`
  padding: ${({ $variant, theme }) =>
    $variant === 'section'
      ? `${tkn('spacing.md')({ theme })} ${tkn('spacing.lg')({ theme })}`
      : tkn('spacing.md')({ theme })};
  border-bottom: none;
  display: flex;
  justify-content: ${({ $variant }) => ($variant === 'panel' ? 'space-between' : 'flex-start')};
  align-items: center;
  gap: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};

  @media (max-width: 63.9375rem) {
    flex-direction: ${({ $variant }) => ($variant === 'panel' ? 'column' : 'row')};
    align-items: ${({ $variant }) => ($variant === 'panel' ? 'stretch' : 'center')};
    padding: ${({ $variant, theme }) =>
      $variant === 'section'
        ? `${tkn('spacing.md+')({ theme })} ${tkn('spacing.lg')({ theme })}`
        : `${tkn('spacing.md+')({ theme })} ${tkn('spacing.md')({ theme })}`};
  }
`;

export const HeaderDivider = styled.div<{ $variant: SettingsCardVariant }>`
  height: 0.0625rem;
  background: ${tkn('colors.border.primary')};
  margin: 0 ${tkn('spacing.lg')};
`;

export const HeaderLeft = styled.div<{ $variant: SettingsCardVariant }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: ${({ $variant }) => ($variant === 'panel' ? '1' : 'initial')};
  max-width: ${({ $variant }) => ($variant === 'panel' ? '50%' : 'none')};
  min-width: 0;

  @media (max-width: 63.9375rem) {
    max-width: 100%;
  }
`;

export const IconWrapper = styled.div<{ $type?: 'location' | 'validation' | 'blacklist' }>`
  width: 2.75rem;
  height: 2.75rem;
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: ${({ theme, $type }) => {
    switch ($type) {
      case 'location':
        return theme.colors.semantic.info + '15';
      case 'validation':
        return theme.colors.semantic.success + '15';
      case 'blacklist':
        return theme.colors.semantic.warning + '15';
      default:
        return theme.colors.brand.primary + '15';
    }
  }};
  border: 0.0625rem solid
    ${({ theme, $type }) => {
      switch ($type) {
        case 'location':
          return theme.colors.semantic.info + '30';
        case 'validation':
          return theme.colors.semantic.success + '30';
        case 'blacklist':
          return theme.colors.semantic.warning + '30';
        default:
          return theme.colors.brand.primary + '30';
      }
    }};
  color: ${({ theme, $type }) => {
    switch ($type) {
      case 'location':
        return theme.colors.semantic.info;
      case 'validation':
        return theme.colors.semantic.success;
      case 'blacklist':
        return theme.colors.semantic.warning;
      default:
        return theme.colors.brand.primary;
    }
  }};
`;

export const TitleContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** Section title — clear and readable (18px / semibold) */
export const Title = styled.div`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.tight')};
  letter-spacing: ${tkn('typography.letterSpacing.tight')};
`;

export const HeaderRight = styled.div<{ $variant: SettingsCardVariant }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: ${({ $variant }) => ($variant === 'panel' ? '1' : '0')};
  max-width: ${({ $variant }) => ($variant === 'panel' ? '50%' : 'none')};
  flex-shrink: 0;

  @media (max-width: 63.9375rem) {
    flex: 1;
    max-width: 100%;
  }
`;

export const CardBody = styled.div<{ $variant: SettingsCardVariant; $hasHeader: boolean }>`
  padding: ${({ $variant, $hasHeader, theme }) =>
    $variant === 'section' && $hasHeader
      ? `${tkn('spacing.sm')({ theme })} ${tkn('spacing.lg')({ theme })} ${tkn('spacing.lg')({ theme })}`
      : tkn('spacing.lg')({ theme })};
  flex: 1;
  display: flex;
  flex-direction: column;
`;
