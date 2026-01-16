import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export const LabelText = styled.div`
  display: block;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.secondary')};
  margin-bottom: ${tkn('spacing.xs')};
  padding-left: ${tkn('spacing.xs')};
`;

export const InputGroup = styled.div<{ $hasError?: boolean; $isFloating?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 64px;
  background-color: ${tkn('colors.background.secondary')};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.lg')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 4px ${tkn('colors.brand.primary')}15;
    background-color: ${tkn('colors.background.primary')};
  }

  &:hover:not(:focus-within) {
    border-color: ${tkn('colors.border.focus')};
    background-color: ${tkn('colors.background.primary')};
  }
`;

export const FloatingLabel = styled.label<{ $isFloating: boolean; $hasError?: boolean; $hasLeftIcon?: boolean }>`
  position: absolute;
  left: ${({ $hasLeftIcon, theme }) => ($hasLeftIcon ? '48px' : tkn('spacing.md')({ theme }))};
  top: ${({ $isFloating }) => ($isFloating ? '10px' : '50%')};
  transform: ${({ $isFloating }) => ($isFloating ? 'none' : 'translateY(-50%)')};
  font-size: ${({ $isFloating }) => ($isFloating ? tkn('typography.fontSize.xs') : tkn('typography.fontSize.md'))};
  font-weight: ${({ $isFloating }) => ($isFloating ? tkn('typography.fontWeight.bold') : tkn('typography.fontWeight.medium'))};
  color: ${({ $hasError, $isFloating, theme }) => 
    $hasError ? tkn('colors.semantic.error')({ theme }) : 
    $isFloating ? tkn('colors.brand.primary')({ theme }) : 
    tkn('colors.text.tertiary')({ theme })
  };
  pointer-events: none;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: ${({ $isFloating }) => ($isFloating ? 'uppercase' : 'none')};
  letter-spacing: ${({ $isFloating }) => ($isFloating ? '0.06em' : 'normal')};
  z-index: 10;
  opacity: ${({ $isFloating }) => ($isFloating ? 1 : 0.7)};
  line-height: 1;
`;

export const Addon = styled.div<{ side: 'left' | 'right' }>`
  padding: 0 ${tkn('spacing.md')};
  height: 100%;
  display: flex;
  align-items: center;
  background-color: ${tkn('colors.background.primary')};
  color: ${tkn('colors.text.secondary')};
  border-${({ side }) => (side === 'left' ? 'right' : 'left')}: 1px solid ${tkn('colors.border.primary')};
  font-size: ${tkn('typography.fontSize.md')};
  white-space: nowrap;
`;

export const IconWrapper = styled.div<{ side: 'left' | 'right' }>`
  padding-${({ side }) => (side === 'left' ? 'left' : 'right')}: ${tkn('spacing.md')};
  display: flex;
  align-items: center;
  color: ${tkn('colors.text.tertiary')};
  z-index: 11;
  transition: color ${tkn('transitions.fast')};

  div:focus-within & {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const InnerInput = styled.input<{ $isFloating: boolean; $hasLeftIcon?: boolean; $hasRightIcon?: boolean }>`
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  padding-left: ${({ $hasLeftIcon }) => ($hasLeftIcon ? '0' : tkn('spacing.md'))};
  padding-right: ${({ $hasRightIcon }) => ($hasRightIcon ? '0' : tkn('spacing.md'))};
  padding-top: ${({ $isFloating }) => ($isFloating ? '24px' : '0')};
  padding-bottom: ${({ $isFloating }) => ($isFloating ? '4px' : '0')};
  font-size: ${tkn('typography.fontSize.md')};
  color: ${tkn('colors.text.primary')};
  outline: none;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 12;

  &:disabled {
    cursor: not-allowed;
  }

  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus,
  &:-webkit-autofill:active {
    transition: background-color 5000s ease-in-out 0s;
    -webkit-text-fill-color: ${tkn('colors.text.primary')};
    caret-color: ${tkn('colors.text.primary')};
  }
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  margin-top: ${tkn('spacing.xs')};
  padding-left: ${tkn('spacing.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  animation: slideIn 0.2s ease-out;

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;
