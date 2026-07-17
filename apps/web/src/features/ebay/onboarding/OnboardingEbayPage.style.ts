/**
 * OnboardingEbayPage Styles
 *
 * Single-column layout — consistent with EbayConnectPage / StoreSettingsPage.
 * Rendered inside AppLayout (sidebar + breadcrumb).
 */

import styled from '@emotion/styled';
import { PageContainer, Text, tkn } from '@repo/ui';

/** Narrow onboarding column — still uses standard page gap / no outer pad */
export const Container = styled(PageContainer)`
  max-width: 37.5rem; /* 600px */
  margin: 0 auto;
`;
export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xl')};
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
