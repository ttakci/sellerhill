import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const MasterCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
`;

export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const EventList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const EventRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const EventRowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const EventTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const InfoButton = styled(IconButton)`
  flex-shrink: 0;
`;

export const EventControls = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.xs')};

  @media (min-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`;

export const SelectWrapper = styled.div`
  min-width: 0;
`;

export const DelaySelectWrapper = styled.div`
  min-width: 8rem;
`;
