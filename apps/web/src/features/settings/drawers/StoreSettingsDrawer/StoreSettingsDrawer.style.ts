import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

/**
 * Under the scope picker: whether the chosen store runs on its own settings
 * or on "all stores", and — when it has its own — the way back. Wraps so the
 * button drops under the sentence on a phone.
 */
export const ScopeStatus = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.glass.tint')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};

  /* The sentence takes the spare room; the button keeps its own width.
     (Not :first-of-type — that matches the first span AND the first button.) */
  & > :first-child {
    flex: 1 1 10rem;
    min-width: 0;
  }

  & > :not(:first-child) {
    flex: 0 0 auto;
  }
`;

/** The global scope's "who follows these settings" lines — same tinted box as `ScopeStatus`. */
export const ScopeSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.glass.tint')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

/**
 * One automation field: a label row (label + info tooltip trigger) stacked
 * above its control. Replaces the per-field `InfoMessage` blocks — the
 * explanation moves onto an "i" tooltip beside the label, matching
 * `BuyerMessagingSection`.
 */
export const AutomationField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/**
 * Label text plus its trailing info-tooltip trigger, flowed as normal inline
 * content (not a flex row) so a long label wraps as a single unit — the icon
 * stays attached right after the last word instead of centering against the
 * full height of a two-line label, which is what a flex row with
 * `align-items: center` did.
 */
export const LabelWithInfo = styled.div`
  min-width: 0;
`;

/**
 * The "i" tooltip trigger, flowed inline right after the label text.
 *
 * `IconButton` pads its box and forces `& svg` to 1.25rem; against a `body-sm`
 * label that padded, oversized box rode visibly above the text. Strip the
 * padding and honour the 14px the trigger passes so `vertical-align: middle`
 * lands the glyph on the label's own midline.
 */
export const InfoButton = styled(IconButton)`
  margin-left: ${tkn('spacing.xs')};
  padding: 0;
  vertical-align: middle;

  & svg {
    width: 0.875rem;
    height: 0.875rem;
  }
`;

/**
 * Heading + spacing for one titled group inside a `FormCard`.
 *
 * Deliberately NOT its own bordered box: the address used to sit in a nested
 * card inside the form card, which read to sellers as a SECOND address form
 * when it was always one address split across two groups (the location half fed
 * eBay, the street half fed the tracking provider). One card, one address.
 */
export const FieldGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;
