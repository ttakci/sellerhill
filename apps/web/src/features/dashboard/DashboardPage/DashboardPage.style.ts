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
`;


/* The rail itself lives in the shared TabNav atom. */
export const Tabs = styled(TabNav)`
  flex: 1 1 auto;
  min-width: 0;
`;

/**
 * Shrink-wraps the Dropdown: its own container is `width: 100%`, so without an
 * auto-width flex parent it claimed the whole row and pushed itself below the tabs.
 */
export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
  padding-bottom: ${tkn('spacing.xs')};
  align-self: center;
`;

export const StoreTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  max-width: 14rem;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  font: inherit;
  white-space: nowrap;
  transition:
    border-color ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
    border-color: ${tkn('colors.brand.primary')};
  }
`;

/** Long store names truncate instead of widening the toolbar. */
export const StoreLabel = styled.span`
  min-width: 0;
  overflow: hidden;
`;
