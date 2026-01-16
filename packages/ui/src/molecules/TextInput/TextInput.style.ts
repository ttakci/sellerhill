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
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.sm')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  height: 44px;

  &:focus-within {
    border-color: ${tkn('colors.border.focus')};
    box-shadow: 0 0 0 3px ${tkn('colors.brand.secondary')};
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
  padding-left: ${({ $hasLeftIcon, theme }) => ($hasLeftIcon ? '10px' : tkn('spacing.md')({ theme }))};
  padding-right: ${({ $hasRightIcon, theme }) => ($hasRightIcon ? '10px' : tkn('spacing.md')({ theme }))};
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
