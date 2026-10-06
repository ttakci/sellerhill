import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

export const CampaignList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const CampaignRow = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

export const Summary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
