import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  width: 100%;
`;

export const LabelText = styled.div`
  display: block;
`;

export const InputGroup = styled.div<{ $hasError?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  background-color: ${tkn('colors.background.secondary')};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.md')};
  transition: border-color ${tkn('transitions.fast')};
  overflow: hidden;

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
  }
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
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.semantic.error')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;
