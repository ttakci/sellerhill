import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { BodyStack, FormCard } from '../shared/drawerSurfaces.style';
export {
  AutomationField as Field,
  FieldGroup,
  InfoButton,
  LabelWithInfo,
  ToggleRow,
} from '../StoreSettingsDrawer/StoreSettingsDrawer.style';

/** Minimum and maximum price side by side; stacked on a phone. */
export const PriceRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
  }
`;
