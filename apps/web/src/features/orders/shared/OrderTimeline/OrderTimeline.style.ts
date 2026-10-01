import styled from '@emotion/styled';
import { OrderTimelineStepState } from '@repo/shared';
import { tkn } from '@repo/ui';

/*
 * One row per step: marker rail · step name · when · what happened.
 * From `md` up the four sit on one line, so the names, the times and the
 * descriptions each read down a column. Below `md` the row keeps the rail and
 * stacks the rest (name, then the time, then the description) — four columns
 * do not fit a phone, and a date beside the name forced every name to wrap.
 */
export const List = styled.div`
  display: flex;
  flex-direction: column;
`;

export const Row = styled.div`
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  grid-template-areas:
    'rail head'
    'rail when'
    'rail body';
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.2xs')};
  /* Name and time stay level with the marker however tall the description
     gets; only the rail stretches (its line has to reach the next row). */
  align-items: start;
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: 2rem minmax(10rem, 15rem) minmax(8.5rem, 10.5rem) minmax(0, 1fr);
    grid-template-areas: 'rail head when body';
    column-gap: ${tkn('spacing.lg')};
  }
`;

/** Marker + the line running down to the next row. Spans the row's full
 *  height, so the line is continuous however tall the description gets. */
export const Rail = styled.div`
  grid-area: rail;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export const Marker = styled.div<{ $state: OrderTimelineStepState; $small: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-sizing: border-box;
  width: ${({ $small }) => ($small ? '1.25rem' : '2rem')};
  height: ${({ $small }) => ($small ? '1.25rem' : '2rem')};
  /* A message marker is smaller; centre it on the same axis as the big ones. */
  margin: ${({ $small }) => ($small ? '0.125rem 0' : '0')};
  border-radius: ${tkn('radius.full')};
  border: 0.0625rem ${({ $state }) => ($state === OrderTimelineStepState.SKIPPED ? 'dashed' : 'solid')}
    ${({ $state, theme }) => {
      switch ($state) {
        case OrderTimelineStepState.DONE:
          return theme.colors.semanticTintBorder.success;
        case OrderTimelineStepState.CURRENT:
          return theme.colors.brand.primary;
        case OrderTimelineStepState.ATTENTION:
          return theme.colors.semantic.error;
        default:
          return theme.colors.border.control;
      }
    }};
  background: ${({ $state, theme }) => {
    switch ($state) {
      case OrderTimelineStepState.DONE:
        return theme.colors.semanticTint.success;
      case OrderTimelineStepState.CURRENT:
        return theme.colors.semanticTint.info;
      case OrderTimelineStepState.ATTENTION:
        return theme.colors.semanticTint.error;
      default:
        return theme.colors.surface.primary;
    }
  }};
  color: ${({ $state, theme }) => {
    switch ($state) {
      case OrderTimelineStepState.DONE:
        return theme.colors.semantic.success;
      case OrderTimelineStepState.CURRENT:
        return theme.colors.brand.primary;
      case OrderTimelineStepState.ATTENTION:
        return theme.colors.semantic.error;
      default:
        return theme.colors.text.tertiary;
    }
  }};
`;

export const Connector = styled.div`
  flex: 1 1 auto;
  width: 0.0625rem;
  min-height: ${tkn('spacing.md')};
  background: ${tkn('colors.border.control')};
`;

/** Step name (+ the id that belongs to it). Vertically centred on the marker. */
export const Head = styled.div<{ $message: boolean }>`
  grid-area: head;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  min-height: ${({ $message }) => ($message ? '1.5rem' : '2rem')};
  overflow-wrap: anywhere;
`;

export const When = styled.div<{ $message: boolean; $empty: boolean }>`
  grid-area: when;
  /* Stacked (phone): a step with no time yet shows no line at all, rather
     than a lone dash between its name and its description. */
  display: ${({ $empty }) => ($empty ? 'none' : 'flex')};
  align-items: center;
  white-space: nowrap;

  @media (min-width: ${tkn('breakpoints.md')}) {
    display: flex;
    min-height: ${({ $message }) => ($message ? '1.5rem' : '2rem')};
  }
`;

/** What happened, and — on the step the order is standing on — what to do.
 *  The bottom padding is the gap between rows; it lives here (not on Row) so
 *  the rail's line runs through it unbroken. */
export const Body = styled.div<{ $last: boolean; $message: boolean }>`
  grid-area: body;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  padding-bottom: ${({ $last }) => ($last ? '0' : tkn('spacing.md'))};

  @media (min-width: ${tkn('breakpoints.md')}) {
    justify-content: flex-start;
    /* Sit on the marker's centre line when the text is a single line. */
    padding-top: ${({ $message }) => ($message ? '0.125rem' : '0.375rem')};
  }
`;
