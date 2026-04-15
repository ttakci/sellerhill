import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { ProgressBarSize, ProgressBarVariant } from './ProgressBar.types';

export const ProgressBarWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  width: 100%;
`;

export const ProgressBarTrack = styled.div<{ $size: ProgressBarSize }>`
  flex: 1;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.full')};
  overflow: hidden;

  ${(props) => {
    switch (props.$size) {
      case 'sm':
        return `height: 0.25rem;`;
      case 'md':
        return `height: 0.5rem;`;
      default:
        return `height: 0.5rem;`;
    }
  }}
`;

export const ProgressBarFill = styled.div<{
  $variant: ProgressBarVariant;
  $value: number;
  $size: ProgressBarSize;
}>`
  height: 100%;
  border-radius: ${tkn('radius.full')};
  transition: width ${tkn('transitions.fast')};

  ${(props) => {
    const width = Math.max(0, Math.min(100, props.$value));
    return `width: ${width}%;`;
  }}

  ${(props) => {
    switch (props.$variant) {
      case 'success':
        return `background: ${tkn('colors.semantic.success')(props)};`;
      case 'warning':
        return `background: ${tkn('colors.semantic.warning')(props)};`;
      case 'error':
        return `background: ${tkn('colors.semantic.error')(props)};`;
      case 'default':
      default:
        return `background: ${tkn('colors.brand.primary')(props)};`;
    }
  }}
`;

export const ProgressBarLabel = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  white-space: nowrap;
  min-width: 2.5rem;
  text-align: right;
`;
