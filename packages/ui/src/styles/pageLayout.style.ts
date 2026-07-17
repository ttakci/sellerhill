/**
 * App page layout tokens / shells.
 *
 * Horizontal + top gutter lives in AppLayout `ContentInner` only.
 * Feature page containers must NOT add outer padding (avoids double inset).
 */

import styled from '@emotion/styled';

import { tkn } from '../theme/tkn';

/**
 * Standard authenticated-app page shell.
 * Use as the root of every AppLayout page:
 *   <PageContainer>
 *     <PageHeader title="..." subtitle="..." />
 *     …sections…
 *   </PageContainer>
 */
export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  /* Gutter comes from AppLayout ContentInner — never pad here */
  padding: 0;
  /* Comfortable scroll end */
  padding-bottom: ${tkn('spacing.xxxl')};
`;

/**
 * Detail pages with a sticky mobile action bar need extra bottom room.
 */
export const PageContainerWithMobileBar = styled(PageContainer)`
  padding-bottom: calc(${tkn('spacing.xxxl')} + 4.5rem);

  @media (min-width: 48rem) {
    padding-bottom: ${tkn('spacing.xxxl')};
  }
`;
