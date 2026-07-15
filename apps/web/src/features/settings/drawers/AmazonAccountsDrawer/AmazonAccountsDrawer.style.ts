import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

/**
 * Clickable account card. Selection (not navigation) happens on click; the
 * drawer footer "Continue" action opens the edit flow. The `$selected`
 * transient drives the persistent highlight (dynamic state the Card atom
 * can't express via variants).
 */
export const SelectableCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};

  ${({ $selected, theme }) =>
    $selected
      ? `border-color: ${tkn('colors.brand.primary')({ theme })}; box-shadow: ${tkn('shadows.sm')({ theme })};`
      : ''}
`;

export const AccountList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const AccountMain = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const AccountHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const AccountIdentity = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const AccountIdText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const AccountMetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const AccountMetaLine = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  gap: ${tkn('spacing.md')};
`;

export const EmptyIconCircle = styled.div`
  width: 3.75rem; /* 60px */
  height: 3.75rem;
  border-radius: 50%;
  background-color: ${tkn('colors.background.tertiary')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.tertiary')};
`;
