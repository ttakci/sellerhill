import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: ${tkn('spacing.xs')};
`;

export const LabelText = styled.label`
  display: block;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
`;

export const InputGroup = styled.div<{ $hasError?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  background-color: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid
    ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)}; /* 1px */
  border-radius: ${tkn('radius.sm')};
  transition:
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};
  overflow: hidden;
  height: 2.75rem; /* 44px */

  &:focus-within {
    border-color: ${tkn('colors.border.focus')};
    box-shadow: 0 0 0 0.25rem ${tkn('colors.brand.primary')}15; /* 4px */
  }

  &:hover:not(:focus-within) {
    border-color: ${tkn('colors.border.focus')};
  }
`;

export const IconWrapper = styled.div<{ side: 'left' | 'right' }>`
  padding-${({ side }) => (side === 'left' ? 'left' : 'right')}: ${tkn('spacing.md')};
  display: flex;
  align-items: center;
  color: ${tkn('colors.text.secondary')};
  z-index: 10;
  transition: color ${tkn('transitions.fast')};

  div:focus-within & {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const InnerInput = styled.input<{ $hasLeftIcon?: boolean; $hasRightIcon?: boolean }>`
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  padding-left: ${({ $hasLeftIcon, theme }) => ($hasLeftIcon ? '0.625rem' : tkn('spacing.md')({ theme }))}; /* 10px */
  padding-right: ${({ $hasRightIcon, theme }) =>
    $hasRightIcon ? '0.625rem' : tkn('spacing.md')({ theme })}; /* 10px */
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  color: ${tkn('colors.text.primary')};
  outline: none;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  &:disabled {
    cursor: not-allowed;
    background-color: ${tkn('colors.background.tertiary')};
  }
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;
