import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

export const SearchSlot = styled.div`
  flex: 1 1 16rem;
  max-width: 28rem;
`;

export const Category = styled(Card)`
  display: flex;
  flex-direction: column;
  padding: ${tkn('spacing.md')};
`;

export const EmailTest = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.sm')};
`;

export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: ${tkn('spacing.sm')};
`;

/**
 * One setting = one form. Text on the left, control on the right; stacks on
 * phones. `$fullWidth` drops the two-column split entirely — for a control
 * too rich for a 20rem lane (the scraper proxy list editor).
 */
export const Row = styled.form<{ $fullWidth?: boolean }>`
  display: grid;
  grid-template-columns: ${({ $fullWidth }) => ($fullWidth ? '1fr' : 'minmax(0, 1fr) minmax(0, 20rem)')};
  align-items: start;
  gap: ${tkn('spacing.md')};
  padding-block: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.primary')};

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const RowText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const Meta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const Control = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const ToggleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-height: 2.75rem;
`;

export const Actions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

/** Live region for the row's "Saved" confirmation; takes no space while empty. */
export const Status = styled.div`
  &:empty {
    display: none;
  }
`;
