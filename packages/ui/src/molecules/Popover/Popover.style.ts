import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { PopoverPosition } from './Popover.types';

export const PopoverWrapper = styled.div`
  position: relative;
  display: inline-flex;
`;

const positionStyles: Record<PopoverPosition, string> = {
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

export const PopoverContent = styled.div<{ $position: PopoverPosition }>`
  position: absolute;
  z-index: 1000;
  min-width: 12rem;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.lg')};
  padding: ${tkn('spacing.sm')};
  ${(props) => positionStyles[props.$position]}
`;

export const PopoverArrow = styled.div<{ $position: PopoverPosition }>`
  position: absolute;
  width: 0.5rem;
  height: 0.5rem;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  transform: rotate(45deg);

  ${(props) => {
    switch (props.$position) {
      case 'top':
        return css`
          bottom: -0.3125rem;
          left: 50%;
          margin-left: -0.25rem;
          border-top: none;
          border-left: none;
        `;
      case 'bottom':
        return css`
          top: -0.3125rem;
          left: 50%;
          margin-left: -0.25rem;
          border-bottom: none;
          border-right: none;
        `;
      case 'left':
        return css`
          right: -0.3125rem;
          top: 50%;
          margin-top: -0.25rem;
          border-bottom: none;
          border-left: none;
        `;
      case 'right':
        return css`
          left: -0.3125rem;
          top: 50%;
          margin-top: -0.25rem;
          border-top: none;
          border-right: none;
        `;
    }
  }}
`;
