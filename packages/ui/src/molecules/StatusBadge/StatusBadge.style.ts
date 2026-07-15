import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import { getStatusColors, type StatusSize } from './StatusBadge.types';

const sizeStyles = ($size: StatusSize, theme: Theme) => {
  const t = (path: Parameters<typeof tkn>[0]) => tkn(path)({ theme });
  switch ($size) {
    case 'sm':
      return `
        padding: ${t('spacing.2xs')} ${t('spacing.sm')};
        font-size: ${t('typography.fontSize.2xs')};
      `;
    case 'lg':
      return `
        padding: ${t('spacing.xs')} ${t('spacing.sm-md')};
        font-size: ${t('typography.fontSize.sm')};
      `;
    case 'md':
    default:
      return `
        padding: ${t('spacing.2xs')} ${t('spacing.sm+')};
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
  gap: ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: capitalize;
  letter-spacing: ${tkn('typography.letterSpacing.wide')};
  border: 0.0625rem solid transparent;
  white-space: nowrap;
  line-height: ${tkn('typography.lineHeight.normal')};

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
