import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from '../../shared/drawerSurfaces.style';

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const EventRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm')} 0;
`;

export const EventRowHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const EventControls = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const SelectWrapper = styled.div`
  min-width: ${tkn('spacing.xxxl')};
  flex: 1;
`;

export const ManageRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
`;
