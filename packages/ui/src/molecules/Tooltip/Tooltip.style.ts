import styled from '@emotion/styled';

import type { AppTheme } from '../../theme/theme.types';
import { tkn } from '../../theme/tkn';

import type { TooltipPosition, TooltipVariant } from './Tooltip.types';

export const TooltipWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

export const TooltipPortal = styled.div<{
  $position: TooltipPosition;
  $variant: TooltipVariant;
  $top: number;
  $left: number;
}>`
  position: fixed;
  z-index: 9999;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.md')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  line-height: ${tkn('typography.lineHeight.normal')};
  white-space: normal;
  pointer-events: none;
  max-width: 20rem;
  word-break: break-word;
  transition: opacity 0.15s ease;

  /* Arrow */
  &::after {
    content: '';
    position: absolute;
    width: 0;
    height: 0;
    border-style: solid;
    border-width: 0.375rem;
  }

  /* Positioning */
  ${({ $position, $top, $left }) => {
    switch ($position) {
      case 'top':
        return `
          top: ${$top}px;
          left: ${$left}px;
          transform: translate(-50%, -100%);
          &::after {
            top: 100%;
            left: 50%;
            transform: translateX(-50%);
          }
        `;
      case 'bottom':
        return `
          top: ${$top}px;
          left: ${$left}px;
          transform: translate(-50%, 0);
          &::after {
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
          }
        `;
      case 'left':
        return `
          top: ${$top}px;
          left: ${$left}px;
          transform: translate(-100%, -50%);
          &::after {
            left: 100%;
            top: 50%;
            transform: translateY(-50%);
          }
        `;
      case 'right':
        return `
          top: ${$top}px;
          left: ${$left}px;
          transform: translate(0, -50%);
          &::after {
            right: 100%;
            top: 50%;
            transform: translateY(-50%);
          }
        `;
    }
  }}

  /* Variant */
  ${({ $position, $variant, theme }) => {
    const t = theme as AppTheme;
    const bg = $variant === 'dark'
      ? t.colors.text.primary
      : t.colors.surface.primary;
    const arrowMap: Record<TooltipPosition, string> = {
      top: `${bg} transparent transparent transparent`,
      bottom: `transparent transparent ${bg} transparent`,
      left: `transparent transparent transparent ${bg}`,
      right: `transparent ${bg} transparent transparent`,
    };
    if ($variant === 'dark') {
      return `
        background: ${bg};
        color: ${t.colors.text.inverse};
        &::after { border-color: ${arrowMap[$position]}; }
      `;
    }
    return `
      background: ${bg};
      color: ${t.colors.text.primary};
      border: 0.0625rem solid ${t.colors.border.primary};
      box-shadow: ${t.shadows.sm};
      &::after { border-color: ${arrowMap[$position]}; }
    `;
  }}
`;
