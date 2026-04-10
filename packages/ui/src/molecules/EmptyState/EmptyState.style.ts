import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { EmptyStateSize } from './EmptyState.types';

export const EmptyStateWrapper = styled.div<{ $size: EmptyStateSize }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ $size }) =>
    $size === 'sm'
      ? `${tkn('spacing.md')} ${tkn('spacing.sm')}`
      : `${tkn('spacing.xl')} ${tkn('spacing.md')}`};
  gap: ${({ $size }) =>
    $size === 'sm' ? tkn('spacing.sm') : $size === 'lg' ? tkn('spacing.lg') : tkn('spacing.md')};
`;

export const IconCircle = styled.div<{ $size: EmptyStateSize }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => ($size === 'sm' ? '3rem' : $size === 'lg' ? '6rem' : '4.5rem')};
  height: ${({ $size }) => ($size === 'sm' ? '3rem' : $size === 'lg' ? '6rem' : '4.5rem')};
  border-radius: ${tkn('radius.full')};
  background-color: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.text.tertiary')};
  margin-bottom: ${tkn('spacing.sm')};

  svg {
    width: ${({ $size }) => ($size === 'sm' ? '1.5rem' : $size === 'lg' ? '2.5rem' : '2rem')};
    height: ${({ $size }) => ($size === 'sm' ? '1.5rem' : $size === 'lg' ? '2.5rem' : '2rem')};
  }
`;

export const Title = styled.h3<{ $size: EmptyStateSize }>`
  margin: 0;
  font-size: ${({ $size }) =>
    $size === 'sm' ? tkn('typography.fontSize.sm') : $size === 'lg' ? tkn('typography.fontSize.lg') : tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const Description = styled.p<{ $size: EmptyStateSize }>`
  margin: 0;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  max-width: 28rem;
`;
