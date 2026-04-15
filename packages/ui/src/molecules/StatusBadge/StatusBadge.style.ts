import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import { getStatusColors, type StatusSize } from './StatusBadge.types';

const sizeStyles = ($size: StatusSize, theme: Theme) => {
  const t = (path: Parameters<typeof tkn>[0]) => tkn(path)({ theme });
  switch ($size) {
    case 'sm':
      return `
        padding: 0.0625rem 0.5rem;
        font-size: ${t('typography.fontSize.2xs')};
      `;
    case 'lg':
      return `
        padding: 0.25rem 0.75rem;
        font-size: ${t('typography.fontSize.sm')};
      `;
    case 'md':
    default:
      return `
        padding: 0.125rem 0.625rem;
        font-size: ${t('typography.fontSize.xs')};
      `;
  }
};

export const StatusBadgeContainer = styled.span<{
  $status: string;
  $size: StatusSize;
}>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  border-radius: ${tkn('radius.full')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: capitalize;
  letter-spacing: 0.01em;
  border: 0.0625rem solid transparent;
  white-space: nowrap;
  line-height: 1.5;

  ${({ $size, theme }) => sizeStyles($size, theme)}

  ${({ $status, theme }) => {
    const colors = getStatusColors($status, theme);
    return `
      background: ${colors.background};
      color: ${colors.color};
      border-color: ${colors.border};
    `;
  }}
`;
