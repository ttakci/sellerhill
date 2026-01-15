import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;

export const LabelText = styled.div`
  display: block;
`;

export const InputGroup = styled.div<{ $hasError?: boolean; $isFloating?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: 62px; /* Increased for better vertical balance with floating labels */
  background-color: ${tkn('colors.background.secondary')};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.md')};
  transition: all ${tkn('transitions.fast')};
  overflow: hidden;

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 1px ${tkn('colors.brand.primary')};
    background-color: ${tkn('colors.background.primary')};
  }

  &:hover:not(:focus-within) {
    border-color: ${tkn('colors.border.secondary')};
  }
`;

export const FloatingLabel = styled.label<{ $isFloating: boolean; $hasError?: boolean; $hasLeftIcon?: boolean }>`
  position: absolute;
  left: ${({ $hasLeftIcon, theme }) => ($hasLeftIcon ? '44px' : tkn('spacing.md')({ theme }))};
  top: ${({ $isFloating }) => ($isFloating ? '8px' : '50%')};
  transform: ${({ $isFloating }) => ($isFloating ? 'none' : 'translateY(-50%)')};
  font-size: ${({ $isFloating }) => ($isFloating ? tkn('typography.fontSize.xs') : tkn('typography.fontSize.sm'))};
  font-weight: ${({ $isFloating }) => ($isFloating ? tkn('typography.fontWeight.bold') : tkn('typography.fontWeight.normal'))};
  color: ${({ $hasError, $isFloating, theme }) => 
    $hasError ? tkn('colors.semantic.error')({ theme }) : 
    $isFloating ? tkn('colors.brand.primary')({ theme }) : 
    tkn('colors.text.tertiary')({ theme })
  };
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  text-transform: ${({ $isFloating }) => ($isFloating ? 'uppercase' : 'none')};
  letter-spacing: ${({ $isFloating }) => ($isFloating ? '0.04em' : 'normal')};
  z-index: 10;
  opacity: 0.9;
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
  color: ${tkn('colors.text.secondary')};
  z-index: 11;
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  margin-top: 4px;
  padding-left: 2px;
  font-weight: ${tkn('typography.fontWeight.medium')};
`;
