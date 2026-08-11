import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  min-height: 100%;
`;

export const List = styled.div`
  display: flex;
  flex-direction: column;
`;

export const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:last-child {
    border-bottom: none;
  }
`;

export const ChangeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
`;

export const ChangeItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const ChangeValues = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const Arrow = styled.span<{ $tone: 'up' | 'down' | 'flat' }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: ${({ $tone, theme }) => {
    if ($tone === 'up') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'down') {
      return theme.colors.semantic.error;
    }
    return theme.colors.text.tertiary;
  }};
`;

export const PagerRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const PagerButton = styled(IconButton)`
  width: 2rem;
  height: 2rem;
`;

export const EmptyWrap = styled.div`
  padding: ${tkn('spacing.xl')} 0;
`;
