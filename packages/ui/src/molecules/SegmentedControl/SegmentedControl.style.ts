import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/**
 * Hugs its segments. `width: fit-content` is what stops a column-flex parent
 * (a drawer form card) from stretching the tinted track to the row's end —
 * `inline-flex` alone does not, because flex items ignore their display's
 * inline-ness and take `align-items: stretch`.
 *
 * The track is exactly as tall as a compact control of the same size
 * (`controls.height.small` / `medium`), so a segmented switch sits level with
 * a Select or Button beside it and reads as one of the same family.
 */
export const SegmentedControlContainer = styled.div<{ $size: 'sm' | 'md' }>`
  display: inline-flex;
  align-items: stretch;
  width: fit-content;
  max-width: 100%;
  min-height: ${(props) =>
    props.$size === 'sm' ? tkn('controls.height.small')(props) : tkn('controls.height.medium')(props)};
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.control')};
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.2xs')};
  gap: ${tkn('spacing.2xs')};
`;

/**
 * `font-family` is set explicitly: a `<button>` does not inherit the page's
 * font, so without it every segment rendered in the OS UI font (Segoe UI on
 * Windows) beside Lexend controls. Type and padding come from the same tokens
 * as `Button`, so a segment reads like one of the app's buttons.
 */
export const SegmentButton = styled.button<{ $active: boolean; $size: 'sm' | 'md' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.sans')};
  font-size: ${(props) =>
    props.$size === 'sm' ? tkn('typography.fontSize.sm')(props) : tkn('typography.fontSize.base')(props)};
  line-height: ${tkn('typography.lineHeight.tight')};
  transition: all ${tkn('transitions.fast')};
  white-space: nowrap;
  padding: 0 ${(props) => (props.$size === 'sm' ? tkn('spacing.md')(props) : tkn('spacing.lg')(props))};

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.0625rem;
  }

  ${(props) =>
    props.$active
      ? `
    background: ${tkn('colors.surface.primary')(props)};
    color: ${tkn('colors.brand.primary')(props)};
    font-weight: ${tkn('typography.fontWeight.bold')(props)};
    box-shadow: ${tkn('shadows.sm')(props)};
  `
      : `
    background: transparent;
    color: ${tkn('colors.text.secondary')(props)};
    font-weight: ${tkn('typography.fontWeight.semibold')(props)};

    &:hover {
      color: ${tkn('colors.text.primary')(props)};
      background: ${tkn('colors.surface.primary')(props)};
    }
  `}
`;
