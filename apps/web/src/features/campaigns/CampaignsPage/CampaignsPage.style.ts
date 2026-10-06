import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;
export const Kpis = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(${tkn('spacing.xxxl')} * 3)), 1fr));
  gap: ${tkn('spacing.md')};
  @media (max-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: 1fr;
  }
`;
export const CampaignCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;
export const Facts = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(${tkn('spacing.xxxl')} * 2)), 1fr));
  gap: ${tkn('spacing.md')};
`;
export const Fact = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;
