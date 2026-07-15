import styled from '@emotion/styled';
import { IconButton as IconButtonAtom, tkn } from '@repo/ui';

export const CardWrapper = styled.div<{ $selectable?: boolean }>`
  width: 100%;
  cursor: ${({ $selectable }) => ($selectable ? 'pointer' : 'default')};
`;

export const CardContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')}; /* 12px */
  min-height: 2.5rem; /* 40px */
`;

export const CheckboxSection = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

export const KeywordSection = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  flex: 0 0 50%;
  overflow: hidden;

  > span,
  > p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

export const ScopeSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 45%;
  min-width: 0;
`;

export const ScopeTag = styled.div<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.background.tertiary')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  white-space: nowrap;
`;

export const ActionButton = styled(IconButtonAtom)`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  flex-shrink: 0;

  &:hover {
    background: ${tkn('colors.semantic.error')}15;
    color: ${tkn('colors.semantic.error')};
  }

  &:active {
    transform: scale(0.95);
  }
`;
