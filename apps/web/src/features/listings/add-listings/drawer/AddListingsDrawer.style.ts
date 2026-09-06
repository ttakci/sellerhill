import styled from '@emotion/styled';
import { Text as UIText, Textarea, tkn } from '@repo/ui';

/**
 * Add listings drawer — 2-step flow on soft canvas + white cards.
 * Step 2: ASIN card fills drawer body; the shared Textarea atom (fill mode)
 * occupies the remaining card area.
 */
/**
 * height/min-height are deliberately NOT forced here. A flex item's used
 * height is already definite once flexed (feeding the $fill ASIN step's
 * height:100% chain below), but forcing height:100% + min-height:0
 * unconditionally let this shrink BELOW its own step-0 card content once
 * that content grew taller than the drawer viewport — cards overlapped
 * instead of the Drawer's own scrollable Body (overflow-y:auto) taking
 * over. Leaving min-height at its default 'auto' keeps the content-based
 * floor that makes the ancestor scroll instead.
 */
export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  align-self: stretch;
  width: 100%;
  gap: ${tkn('spacing.lg')};
`;

/**
 * Keep inactive steps mounted so RHF field values are not lost on step change.
 * min-height:0 is scoped to $fill only (the ASIN step, which must clamp to
 * the available height so its textarea can fill it) — the default step-0
 * panel keeps its content-based automatic min-height so a tall settings
 * step pushes the Drawer's Body into scrolling rather than being squeezed
 * shorter than its own cards.
 */
export const StepPanel = styled.div<{ $active: boolean; $fill?: boolean }>`
  display: ${({ $active }) => ($active ? 'flex' : 'none')};
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  ${({ $fill }) =>
    $fill
      ? `
    flex: 1 1 auto;
    min-height: 0;
    height: 100%;
    align-self: stretch;
  `
      : ''}
`;

export const Card = styled.div<{ $fill?: boolean }>`
  background: ${tkn('colors.surface.primary')};
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.sm')};
  border: none;
  box-shadow: ${tkn('shadows.sm')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
  width: 100%;
  min-height: 0;
  ${({ $fill }) =>
    $fill
      ? `
    flex: 1 1 auto;
    height: 100%;
    min-height: calc(100dvh - 12.5rem);
  `
      : ''}
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
  padding-bottom: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  flex-shrink: 0;
`;

/** Each step-0 section is its own card, separated by BodyStack/StepPanel gap. */
export const SectionBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const SectionTitle = styled(UIText)`
  margin: 0;
`;

export const DraftRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const DraftCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
`;

export const PolicyGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
`;

/**
 * Grows to fill remaining card height. Absolute child textarea is pinned
 * so height always matches the white card (not the default Textarea min-height).
 */
export const AsinInputWrapper = styled.div`
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  min-height: 12rem;
  display: flex;
  flex-direction: column;
`;

export const AsinCounter = styled.div`
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.brand.primary')}30;
  flex-shrink: 0;
`;

/**
 * Fills the remaining card area. Was a forked native <textarea> that
 * re-implemented the control border/focus treatment by hand; the shared atom
 * now owns that and exposes `fill` for the absolute-inset behaviour.
 */
export const AsinTextarea = styled(Textarea)`
  height: 100%;
`;

export const Label = styled(UIText)`
  display: block;
  margin-bottom: ${tkn('spacing.xs')};
`;

export const RequiredStar = styled.span`
  color: ${tkn('colors.semantic.error')};
`;

export const FieldError = styled(UIText)`
  margin-top: ${tkn('spacing.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  flex-shrink: 0;
`;
