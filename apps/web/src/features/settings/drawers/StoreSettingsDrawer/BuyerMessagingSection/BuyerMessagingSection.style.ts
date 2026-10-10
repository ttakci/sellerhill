import styled from '@emotion/styled';
import { glassSurface, IconButton, tkn } from '@repo/ui';

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

/** This section sits straight on the drawer canvas, so it takes the drawer's form-card pane. */
export const MasterCard = styled.div`
  ${({ theme }) => glassSurface(theme)}
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
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
  ${({ theme }) => glassSurface(theme)}
  padding: ${tkn('spacing.md+')} ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
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
