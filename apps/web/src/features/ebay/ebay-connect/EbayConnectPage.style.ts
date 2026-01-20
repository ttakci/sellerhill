/**
 * EbayConnectPage Styles
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  max-width: 600px;
  margin: 0 auto;
  padding: ${tkn('spacing.xl')};
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.md')};
  padding: ${tkn('spacing.xxl')};
`;

export const Header = styled.div`
  text-align: center;
  margin-bottom: ${tkn('spacing.xl')};
`;

export const Title = styled.h1`
  font-size: ${tkn('typography.fontSize.xxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0 0 ${tkn('spacing.sm')} 0;
`;

export const Subtitle = styled.p`
  font-size: ${tkn('typography.fontSize.md')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
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

export const InfoText = styled.p`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;

export const ButtonContainer = styled.div`
  width: 100%;
  max-width: 320px;
`;
