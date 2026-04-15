import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const IconWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const ContentWrapper = styled.div`
  text-align: center;
  padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')} ${tkn('spacing.md')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.lg')} ${tkn('spacing.md')} ${tkn('spacing.sm')};
  }
`;

export const TitleWrapper = styled.div`
  margin-bottom: ${tkn('spacing.sm')};
`;

export const FooterWrapper = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
  width: 100%;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')} ${tkn('spacing.xl')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')} ${tkn('spacing.lg')};
    gap: ${tkn('spacing.sm')};
  }

  button {
    min-width: 16rem; /* ~256px - large */
    max-width: 100%;

    @media (max-width: 48rem) {
      min-width: 12rem;
    }
  }
`;
