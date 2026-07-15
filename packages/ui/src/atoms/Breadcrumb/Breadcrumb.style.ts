import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.nav`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
`;

export const Item = styled.div<{ $active?: boolean; $hoverable?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  color: ${({ theme, $active }) => ($active ? theme.colors.text.primary : theme.colors.text.secondary)};
  font-weight: ${({ theme, $active }) =>
    $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  transition: all ${tkn('transitions.fast')};
  cursor: ${({ $hoverable }) => ($hoverable ? 'pointer' : 'default')};

  &:hover {
    color: ${({ theme, $hoverable }) => ($hoverable ? theme.colors.brand.primary : 'inherit')};
  }

  & span {
    line-height: ${tkn('typography.lineHeight.tight')};
    white-space: nowrap;
  }
`;

export const Separator = styled.div`
  display: flex;
  align-items: center;
  color: ${tkn('colors.text.tertiary')};
  opacity: 0.8;
  margin: 0 0.25rem; /* 4px */
`;
