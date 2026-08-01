import styled from '@emotion/styled';

import { compactControlHeight, type ControlSize } from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

import type { SearchFieldVariant } from './SearchField.types';

interface SearchContainerProps {
  $size: ControlSize;
  $variant: SearchFieldVariant;
  $fullWidth: boolean;
}

export const SearchContainer = styled.div<SearchContainerProps>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  height: ${({ $size }) => compactControlHeight($size)};
  padding: 0 ${tkn('spacing.md')};
  box-sizing: border-box;
  background-color: ${({ $variant, theme }) =>
    $variant === 'gray' ? theme.colors.background.tertiary : theme.colors.surface.primary};
  border: 0.0625rem solid ${tkn('colors.border.control')};
  border-radius: ${tkn('radius.md')};
  transition: border-color ${tkn('transitions.fast')};
  box-shadow: none;

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: none;
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
  font-size: ${tkn('typography.fontSize.base')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  outline: none;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }
`;
