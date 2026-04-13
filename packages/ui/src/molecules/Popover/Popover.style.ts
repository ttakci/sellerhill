import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const PopoverWrapper = styled.div`
  display: inline-flex;
  position: relative;
`;

export const PopoverContent = styled.div<{ $position: string }>`
  position: absolute;
  z-index: 1000;
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('shadows.lg')};
  padding: ${tkn('spacing.sm')};
  min-width: 12rem;
  white-space: nowrap;

  ${({ $position }) => {
    const positionStyles = {
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
    return positionStyles[$position as keyof typeof positionStyles] || positionStyles.bottom;
  }}
`;

export const PopoverArrow = styled.div<{ $position: string }>`
  position: absolute;
  width: 0;
  height: 0;
  border: 0.375rem solid transparent;

  ${({ $position }) => {
    const arrowStyles = {
      top: `
        bottom: -0.75rem;
        left: 50%;
        transform: translateX(-50%);
        border-top-color: ${tkn('colors.surface.primary')};
      `,
      bottom: `
        top: -0.75rem;
        left: 50%;
        transform: translateX(-50%);
        border-bottom-color: ${tkn('colors.surface.primary')};
      `,
      left: `
        right: -0.75rem;
        top: 50%;
        transform: translateY(-50%);
        border-left-color: ${tkn('colors.surface.primary')};
      `,
      right: `
        left: -0.75rem;
        top: 50%;
        transform: translateY(-50%);
        border-right-color: ${tkn('colors.surface.primary')};
      `,
    };
    return arrowStyles[$position as keyof typeof arrowStyles] || arrowStyles.bottom;
  }}
`;
