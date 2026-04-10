/**
 * DashboardPage Styles
 */

import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const Container = styled.div`
  max-width: 75rem; /* 1200px */
  margin: 0 auto;
  padding: ${tkn('spacing.xl')};
`;

export const Content = styled.div`
  display: grid;
  gap: ${tkn('spacing.lg')};
`;

export const CardTitle = styled(Text)`
  margin: 0 0 ${tkn('spacing.md')} 0;
`;

export const CardDescription = styled(Text)`
  margin: 0 0 ${tkn('spacing.lg')} 0;
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: ${tkn('spacing.xxl')};
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.md')};
`;

export const EmptyStateText = styled(Text)`
  margin: 0 0 ${tkn('spacing.lg')} 0;
`;

export const ButtonContainer = styled.div`
  max-width: 20rem; /* 320px */
  margin: 0 auto;
`;
