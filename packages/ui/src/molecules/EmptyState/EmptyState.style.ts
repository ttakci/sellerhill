import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { EmptyStateSize } from './EmptyState.types';

export const EmptyStateWrapper = styled.div<{ $size: EmptyStateSize }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${({ $size, theme }) =>
    $size === 'sm'
      ? `${tkn('spacing.md')({ theme })} ${tkn('spacing.sm')({ theme })}`
      : `${tkn('spacing.xl')({ theme })} ${tkn('spacing.md')({ theme })}`};
  gap: ${({ $size }) =>
    $size === 'sm' ? tkn('spacing.sm') : $size === 'lg' ? tkn('spacing.lg') : tkn('spacing.md')};
`;

export const IconCircle = styled.div<{ $size: EmptyStateSize }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => ($size === 'sm' ? '3rem' : $size === 'lg' ? '5.5rem' : '4.5rem')};
  height: ${({ $size }) => ($size === 'sm' ? '3rem' : $size === 'lg' ? '5.5rem' : '4.5rem')};
  border-radius: ${tkn('radius.full')};
  background: ${({ theme }) => `${theme.colors.brand.primary}14`};
  border: 0.0625rem solid ${({ theme }) => `${theme.colors.brand.primary}28`};
  color: ${tkn('colors.brand.primary')};
  margin-bottom: ${tkn('spacing.xs')};

  svg {
    width: ${({ $size }) => ($size === 'sm' ? '1.5rem' : $size === 'lg' ? '2.25rem' : '2rem')};
    height: ${({ $size }) => ($size === 'sm' ? '1.5rem' : $size === 'lg' ? '2.25rem' : '2rem')};
  }
`;

/** Layout wrappers — typography lives on nested Text atoms */
export const Title = styled.div<{ $size: EmptyStateSize }>`
  margin: 0;
  max-width: 28rem;
`;

export const Description = styled.div<{ $size: EmptyStateSize }>`
  margin: 0;
  max-width: 28rem;
  line-height: ${tkn('typography.lineHeight.relaxed')};
`;

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
`;
