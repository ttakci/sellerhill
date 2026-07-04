import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import { SettingsCardVariant } from './SettingsCard.types';

export const CardContainer = styled.div<{ $variant: SettingsCardVariant }>`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
`;

export const CardHeader = styled.div<{ $variant: SettingsCardVariant }>`
  padding: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: ${({ $variant }) => ($variant === 'panel' ? 'space-between' : 'flex-start')};
  align-items: center;
  gap: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};

  @media (max-width: 63.9375rem) {
    /* < 1024px */
    flex-direction: ${({ $variant }) => ($variant === 'panel' ? 'column' : 'row')};
    align-items: ${({ $variant }) => ($variant === 'panel' ? 'stretch' : 'center')};
    padding: ${tkn('spacing.md+')} ${tkn('spacing.md')};
    gap: ${({ $variant, theme }) => ($variant === 'panel' ? tkn('spacing.md+')({ theme }) : tkn('spacing.md')({ theme }))};
  }
`;

export const HeaderLeft = styled.div<{ $variant: SettingsCardVariant }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: ${({ $variant }) => ($variant === 'panel' ? '1' : 'initial')};
  max-width: ${({ $variant }) => ($variant === 'panel' ? '50%' : 'none')};
  min-width: 0;

  @media (max-width: 63.9375rem) {
    /* < 1024px */
    max-width: 100%;
  }
`;

export const IconWrapper = styled.div<{ $type?: 'location' | 'validation' | 'blacklist' }>`
  width: 3rem; /* 48px */
  height: 3rem; /* 48px */
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
    }}; /* 1px */
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
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const Title = styled.div`
  font-size: 1.125rem;
  font-weight: 700;
  color: ${tkn('colors.text.primary')};
  margin: 0;
  line-height: 1.4;
`;

export const HeaderRight = styled.div<{ $variant: SettingsCardVariant }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: ${({ $variant }) => ($variant === 'panel' ? '1' : '0')};
  max-width: ${({ $variant }) => ($variant === 'panel' ? '50%' : 'none')};
  flex-shrink: 0;

  @media (max-width: 63.9375rem) {
    /* < 1024px */
    flex: 1;
    max-width: 100%;
    justify-content: ${({ $variant }) => ($variant === 'panel' ? 'flex-start' : 'flex-start')};
  }
`;

export const CardBody = styled.div`
  padding: ${tkn('spacing.lg')};
  flex: 1;
  display: flex;
  flex-direction: column;
`;
