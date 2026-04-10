import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { TooltipPosition, TooltipVariant } from './Tooltip.types';

export const TooltipWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const positionStyles: Record<TooltipPosition, string> = {
  top: `
    bottom: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
  `,
  bottom: `
    top: calc(100% + 0.5rem);
    left: 50%;
    transform: translateX(-50%);
  `,
  left: `
    right: calc(100% + 0.5rem);
    top: 50%;
    transform: translateY(-50%);
  `,
  right: `
    left: calc(100% + 0.5rem);
    top: 50%;
    transform: translateY(-50%);
  `,
};

export const TooltipContent = styled.div<{
  $position: TooltipPosition;
  $variant: TooltipVariant;
}>`
  position: absolute;
  z-index: 1100;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  font-size: ${tkn('typography.fontSize.xs')};
  line-height: ${tkn('typography.lineHeight.normal')};
  white-space: nowrap;
  pointer-events: none;

  ${(props) => positionStyles[props.$position]}

  ${(props) => {
    if (props.$variant === 'dark') {
      return `
        background: ${tkn('colors.text.primary')(props as any)};
        color: ${tkn('colors.text.inverse')(props as any)};
      `;
    }
    return `
      background: ${tkn('colors.surface.primary')(props as any)};
      color: ${tkn('colors.text.primary')(props as any)};
      border: 0.0625rem solid ${tkn('colors.border.primary')(props as any)};
      box-shadow: ${tkn('shadows.sm')(props as any)};
    `;
  }}
`;
