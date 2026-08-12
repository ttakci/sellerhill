import styled from '@emotion/styled';
import { PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

export const StoresGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18.75rem, 1fr));
  gap: ${tkn('spacing.lg')};
`;

export const StoreCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: ${tkn('spacing.md')};
`;

export const StoreIconWrapper = styled.div`
  width: 3rem;
  height: 3rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.semanticTint.success')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StoreCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const StoreMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;
