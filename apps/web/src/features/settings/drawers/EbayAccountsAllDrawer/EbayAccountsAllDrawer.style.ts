import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const StoreList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  gap: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
`;

export const EmptyIconCircle = styled.div`
  width: 3.75rem;
  height: 3.75rem;
  border-radius: 50%;
  background-color: ${tkn('colors.background.tertiary')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.tertiary')};
`;
