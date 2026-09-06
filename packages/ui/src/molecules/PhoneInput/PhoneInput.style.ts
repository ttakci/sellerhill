import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/**
 * Country picker stacked above the number field. The drawer this lives in is
 * too narrow for a side-by-side layout to breathe, and stacking keeps both
 * labeled controls the same width and perfectly aligned down to 360px.
 */
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;
`;
