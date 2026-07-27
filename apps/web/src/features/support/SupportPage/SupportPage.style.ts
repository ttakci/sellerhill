import styled from '@emotion/styled';
import { Button, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;
export const FilterRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;
export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;
export const ConversationButton = styled(Button)`
  justify-content: space-between;
  width: 100%;
`;
export const ConversationText = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;
