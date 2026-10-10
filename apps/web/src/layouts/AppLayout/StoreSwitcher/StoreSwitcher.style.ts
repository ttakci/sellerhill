import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

import { HeaderProfileArea } from '../AppLayout.style';

/** Same control as the language and profile triggers beside it, capped so a long store name truncates. */
export const Trigger = styled(HeaderProfileArea)`
  gap: ${tkn('spacing.xs')};
  padding-left: ${tkn('spacing.sm-md')};
  max-width: 13rem;
  min-width: 0;
`;

/** The single-store label: the trigger's look without the hover affordance. */
export const StaticLabel = styled(Trigger)`
  cursor: default;

  &:hover {
    background: transparent;
    border-color: transparent;
  }
`;

export const Name = styled.div`
  min-width: 0;
  overflow: hidden;
  display: flex;

  /* Only the icon on a phone. */
  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    display: none;
  }
`;
