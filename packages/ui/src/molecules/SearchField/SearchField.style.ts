import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { SearchFieldSize, SearchFieldVariant } from './SearchField.types';

interface SearchContainerProps {
  $size: SearchFieldSize;
  $variant: SearchFieldVariant;
  $fullWidth: boolean;
}

export const SearchContainer = styled.div<SearchContainerProps>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  height: ${({ $size }) => ($size === 'large' ? '3rem' : '2.5rem')};
  padding: 0 ${tkn('spacing.md')};
  box-sizing: border-box;
  background-color: ${({ $variant }) =>
    $variant === 'gray' ? tkn('colors.background.tertiary') : tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  &:hover {
    border-color: ${tkn('colors.text.tertiary')};
  }

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 0.1875rem ${tkn('colors.brand.primary')}15;
  }
`;

export const SearchIconWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${tkn('colors.text.tertiary')};
`;

export const SearchInput = styled.input`
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  padding: 0;
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  outline: none;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }
`;
