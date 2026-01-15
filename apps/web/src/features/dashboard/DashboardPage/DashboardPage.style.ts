/**
 * DashboardPage Styles
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${tkn('spacing.xl')};
`;

export const Header = styled.div`
  margin-bottom: ${tkn('spacing.xxl')};
`;

export const Title = styled.h1`
  font-size: ${tkn('typography.fontSize.xxxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0 0 ${tkn('spacing.sm')} 0;
`;

export const Subtitle = styled.p`
  font-size: ${tkn('typography.fontSize.lg')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;

export const Greeting = styled.h2`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0 0 ${tkn('spacing.lg')} 0;
`;

export const Content = styled.div`
  display: grid;
  gap: ${tkn('spacing.lg')};
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.md')};
  padding: ${tkn('spacing.xl')};
`;

export const CardTitle = styled.h3`
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0 0 ${tkn('spacing.md')} 0;
`;

export const CardDescription = styled.p`
  font-size: ${tkn('typography.fontSize.md')};
  color: ${tkn('colors.text.secondary')};
  margin: 0 0 ${tkn('spacing.lg')} 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: ${tkn('spacing.xxl')};
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.md')};
`;

export const EmptyStateText = styled.p`
  font-size: ${tkn('typography.fontSize.lg')};
  color: ${tkn('colors.text.secondary')};
  margin: 0 0 ${tkn('spacing.lg')} 0;
`;

export const ButtonContainer = styled.div`
  max-width: 320px;
  margin: 0 auto;
`;
