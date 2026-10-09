import styled from '@emotion/styled';
import { PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

/** The counted tab rail. It scrolls inside itself rather than wrapping or widening the page. */
/* Tabs on the left, the status legend toggle on the right; the opened legend wraps under both. */
export const TabsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const FilterBar = styled.div`
  /* The controls sit on the page canvas — no card of their own, so the first
     row of data is the first surface on the page (see the orders list). */
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.md')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 20rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 12rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-left: auto;
  min-height: ${tkn('controls.height.medium')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.md')}) {
    margin-left: 0;
    min-height: auto;
  }
`;

export const ResultCount = styled(UIText)`
  white-space: nowrap;
`;

/** A table cell that stacks a primary line over its context line(s). */
export const StackCell = styled.div<{ $alignEnd?: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: ${({ $alignEnd }) => ($alignEnd ? 'flex-end' : 'flex-start')};
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** Muted label + value on one line (the eBay order id under the return id). */
export const InlineMeta = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** The buyer comment in the Reason column — two lines, the full text on the tooltip. */
export const CommentClamp = styled(UIText)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
`;
