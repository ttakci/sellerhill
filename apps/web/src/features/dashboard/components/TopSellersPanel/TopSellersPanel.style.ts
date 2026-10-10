/**
 * TopSellersPanel styles — table cells only. The panel itself is the
 * Listings page's DataTable on the canvas, with no card of its own.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** A right-aligned figure with an optional caption under it (change %, "estimated"). */
export const MetricCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;

export const TrendCell = styled.div`
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;
`;
