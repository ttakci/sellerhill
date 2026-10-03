/**
 * DashboardPage styles — page shell, tab rail and store selector.
 * AppLayout ContentInner owns the page gutter — never pad here.
 */

import styled from '@emotion/styled';
import { PageContainer, TabNav, tkn } from '@repo/ui';

export const Container = PageContainer;

/**
 * One row: underline tabs on the left, store filter pinned right on the same
 * baseline. `nowrap` is deliberate — wrapping stacked the two controls and ate
 * a whole row of vertical space on narrow screens; the tab rail scrolls instead.
 */
export const Toolbar = styled.div`
  display: flex;
  align-items: stretch;
  gap: ${tkn('spacing.md')};
  flex-wrap: nowrap;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  /* On a phone the fixed-width select would squeeze the rail into a column of
     tabs; the select takes its own full-width row above the tabs instead. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-wrap: wrap;
    gap: ${tkn('spacing.sm')};
  }
`;


/* The rail itself lives in the shared TabNav atom. */
export const Tabs = styled(TabNav)`
  flex: 1 1 auto;
  min-width: 0;
`;
