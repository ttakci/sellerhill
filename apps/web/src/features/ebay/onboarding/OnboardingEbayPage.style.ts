/**
 * OnboardingEbayPage Styles
 *
 * Single-column layout — consistent with EbayConnectPage / StoreSettingsPage.
 * Rendered inside AppLayout (sidebar + breadcrumb).
 */

import styled from '@emotion/styled';
import { PageContainer, Text, tkn } from '@repo/ui';

/**
 * Page root stays a plain PageContainer. It used to add its own
 * `max-width: 37.5rem; margin: 0 auto`, which re-centred the page title around
 * the column midpoint — every other page starts flush at the ContentInner
 * inset, so this was the one screen whose header didn't line up.
 * The narrow reading column now lives on the inner content wrapper instead.
 */
export const Container = PageContainer;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  max-width: 37.5rem; /* 600px */
`;

export const IconWrapper = styled.div`
  width: 4rem; /* 64px */
  height: 4rem; /* 64px */
  background-color: ${tkn('colors.brand.primary')}15;
  color: ${tkn('colors.brand.primary')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.full')};
`;

export const ActionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  max-width: 20rem; /* 320px */
`;

export const Note = styled(Text)`
  text-align: center;
  max-width: 20rem; /* 320px */
`;
