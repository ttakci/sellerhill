import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.semanticTint.infoStrong')};
  color: ${tkn('colors.text.primary')};
`;

/**
 * Optional action button. No explicit push-right margin: Content's own
 * `flex-grow` already claims every pixel of free space on a wide row, which
 * is what leaves this flush against the container's right edge. That matters
 * on a narrow row too — an explicit `margin-left: auto` would still try to
 * consume the free space "before" this item even once it wraps onto its own
 * line, right-aligning a button that should sit at the row's natural start
 * once there is nothing beside it to push away from.
 *
 * Full width only below `sm`: on a phone a right-sized pill button dropped
 * onto its own line is a small, easy-to-miss tap target, so it spans the row
 * like every other primary mobile action in this app. `& > button` is a plain
 * DOM child selector, not an Emotion component-selector interpolation, so it
 * needs no babel plugin — Button's root element is a real `<button>`.
 */
export const ActionSlot = styled.div`
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;

    & > button {
      width: 100%;
    }
  }
`;

/**
 * White circular well behind the outlined triangle glyph — the same shape
 * Dialog/Toast/ValidationMessage use, so a note reads the same wherever it surfaces.
 */
export const IconWell = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: ${tkn('colors.surface.primary')};
`;

/**
 * `min-width: 12rem` rather than `0` is deliberate: with an action button
 * present, a `0` minimum lets Content shrink to almost nothing before the
 * button is ever pushed to its own line, so the message text and the button
 * end up squeezed onto the same cramped row on a narrow screen instead of the
 * button wrapping cleanly beneath. A floor gives the row's `flex-wrap` a real
 * point at which to break. Harmless for the many text-only call sites — none
 * of them are narrower than this floor.
 */
export const Content = styled.div`
  min-width: 12rem;
  flex: 1 1 12rem;
`;
