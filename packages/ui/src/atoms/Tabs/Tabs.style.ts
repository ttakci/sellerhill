import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';
import { TabNav } from '../TabNav';

export const Container = styled.div`
  width: 100%;
`;

/**
 * The rail itself now lives in `TabNav` — this file used to carry a second copy
 * of the same underline/pill styling. Only the content-owning wrapper is local.
 */
export const Rail = styled(TabNav)`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const Content = styled.div`
  animation: fadeIn ${tkn('transitions.normal')};

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;
