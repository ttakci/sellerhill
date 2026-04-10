/**
 * EbayConnectPage Styles
 */

import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const Container = styled.div`
  max-width: 37.5rem; /* 600px */
  margin: 0 auto;
  padding: ${tkn('spacing.xl')};
`;

export const Content = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};
`;

export const Info = styled.div`
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.md')};
  width: 100%;
  text-align: center;
`;

export const InfoText = styled(Text)`
  margin: 0;
`;

export const ButtonContainer = styled.div`
  width: 100%;
  max-width: 20rem; /* 320px */
`;
