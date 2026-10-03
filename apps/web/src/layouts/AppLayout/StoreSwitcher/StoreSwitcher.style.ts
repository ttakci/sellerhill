import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

import { HeaderProfileArea } from '../AppLayout.style';

/** Same block as the user's name beside it (padding, radius, hover), capped so a long store name truncates. */
export const Trigger = styled(HeaderProfileArea)`
  gap: ${tkn('spacing.xs')};
  max-width: 13rem;
  min-width: 0;
`;

/** The single-store label: the trigger's look without the hover affordance. */
export const StaticLabel = styled(Trigger)`
  cursor: default;

  &:hover {
    background: transparent;
  }
`;

export const Name = styled.div`
  min-width: 0;
  overflow: hidden;
  display: flex;

  @media (max-width: 47.9375rem) {
    /* 767px — only the icon on a phone */
    display: none;
  }
`;
