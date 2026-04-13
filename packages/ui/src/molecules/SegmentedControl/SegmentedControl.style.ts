import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const SegmentedControlContainer = styled.div<{ $size: 'sm' | 'md' }>`
  display: inline-flex;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  padding: 0.125rem;
  gap: 0.125rem;
`;

export const SegmentButton = styled.button<{ $active: boolean; $size: 'sm' | 'md' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  font-size: ${(props) =>
    props.$size === 'sm' ? tkn('typography.fontSize.xs')(props as any) : tkn('typography.fontSize.sm')(props as any)};
  font-weight: ${tkn('typography.fontWeight.medium')};
  transition: all ${tkn('transitions.fast')};
  white-space: nowrap;

  ${(props) => {
    const padding = props.$size === 'sm' ? '0.25rem 0.75rem' : '0.375rem 1rem';
    return `padding: ${padding};`;
  }}

  ${(props) =>
    props.$active
      ? `
    background: ${tkn('colors.surface.primary')(props as any)};
    color: ${tkn('colors.text.primary')(props as any)};
    box-shadow: ${tkn('shadows.sm')(props as any)};
  `
      : `
    background: transparent;
    color: ${tkn('colors.text.secondary')(props as any)};

    &:hover {
      color: ${tkn('colors.text.primary')(props as any)};
    }
  `}
`;
