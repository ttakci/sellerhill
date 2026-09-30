import styled from '@emotion/styled';
import { PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

/** The counted tab rail. It scrolls inside itself rather than wrapping or widening the page. */
export const TabsRow = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  overflow-x: auto;
`;

export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: visible;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
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
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.sm')};
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
