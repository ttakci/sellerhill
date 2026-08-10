import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Arrow = styled.span<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  transition: transform ${tkn('transitions.fast')};
`;

export const Row = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} 0;
  border: none;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  background: transparent;
  width: 100%;
  text-align: left;
  cursor: pointer;
  color: inherit;
  font: inherit;

  &:last-child {
    border-bottom: none;
  }

  &:hover > :last-child {
    transform: translateX(0.125rem);
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
  }
`;

export const Info = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 0;
`;

export const RowIcon = styled.span<{ $danger?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ $danger, theme }) =>
    $danger ? theme.colors.semantic.error : theme.colors.brand.primary};
`;

export const TextStack = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;
