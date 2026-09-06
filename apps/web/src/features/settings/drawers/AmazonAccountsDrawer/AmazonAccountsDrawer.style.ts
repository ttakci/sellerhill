import styled from '@emotion/styled';

import { FormCard } from '../shared/drawerSurfaces.style';

import { CAROUSEL_CARD_MIN_HEIGHT } from '@/features/settings/components/cardMetrics';

export { BodyStack } from '../shared/drawerSurfaces.style';

/**
 * The empty-state surface stands in for an account card, so it takes the same
 * height a populated `AmazonAccountCard` would (`CAROUSEL_CARD_MIN_HEIGHT`) and
 * centres its content — otherwise the drawer visibly reflows once the first
 * account is added.
 */
export const EmptyCard = styled(FormCard)`
  min-height: ${CAROUSEL_CARD_MIN_HEIGHT};
  align-items: center;
  justify-content: center;
`;
