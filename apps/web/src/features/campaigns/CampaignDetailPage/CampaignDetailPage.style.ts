import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

export const Members = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
