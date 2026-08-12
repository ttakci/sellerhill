import styled from '@emotion/styled';
import { PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: visible;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.md')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 16rem;
  flex-shrink: 0;

  @media (max-width: 48rem) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 12rem;
  flex-shrink: 0;

  @media (max-width: 48rem) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-left: auto;
  min-height: ${tkn('controls.height.medium')};
  flex-wrap: wrap;

  @media (max-width: 48rem) {
    margin-left: 0;
    min-height: auto;
  }
`;

export const ResultCount = styled(UIText)`
  white-space: nowrap;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.sm')};
`;

export const BuyerCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const ProfitCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const AutoFulfillCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

