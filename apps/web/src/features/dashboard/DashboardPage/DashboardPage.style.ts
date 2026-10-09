/**
 * DashboardPage styles — page shell, tab rail and the date filter.
 * AppLayout ContentInner owns the page gutter — never pad here.
 */

import styled from '@emotion/styled';
import { DateRangePicker, PageContainer, tkn } from '@repo/ui';

import { StatusTabs } from '@/components/StatusTabs';

export const Container = PageContainer;

/**
 * One row: underline tabs on the left, the date filter pinned right on the
 * same baseline. `nowrap` is deliberate — wrapping stacked the two controls and
 * ate a whole row of vertical space on narrow screens; the tab rail scrolls
 * instead.
 */
export const Toolbar = styled.div`
  display: flex;
  align-items: stretch;
  gap: ${tkn('spacing.md')};
  flex-wrap: nowrap;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  /* On a phone the date filter would squeeze the rail into a column of tabs;
     it takes its own full-width row above the tabs instead. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-wrap: wrap;
    gap: ${tkn('spacing.sm')};
  }
`;

/* The shared status rail (the Orders look): only the selected tab takes its colour. */
export const Tabs = styled(StatusTabs)`
  flex: 1 1 auto;
  min-width: 0;
`;

/** The date filter sits at the right end of the tab rail, on its baseline. */
export const RangePicker = styled(DateRangePicker)`
  flex: 0 0 auto;
  align-self: center;
  margin-bottom: ${tkn('spacing.xs')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    order: -1;
    width: 100%;
  }
`;
