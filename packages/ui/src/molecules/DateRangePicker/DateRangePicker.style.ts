import styled from '@emotion/styled';

import { CONTROL_BORDER_COLOR_PATH, CONTROL_PADDING_X, controlHeight } from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  position: relative;
  display: inline-flex;
`;

/** Compact control: same height as a small Select so it sits on the tab rail's baseline. */
export const Trigger = styled.button<{ $isOpen: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  box-sizing: border-box;
  height: ${controlHeight('small', false)};
  padding: 0 ${CONTROL_PADDING_X};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid
    ${({ $isOpen, theme }) => ($isOpen ? theme.colors.brand.primary : tkn(CONTROL_BORDER_COLOR_PATH)({ theme }))};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  white-space: nowrap;

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const TriggerText = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
`;

/** Opens toward the left: the control sits at the rail's right end. */
export const Panel = styled.div`
  position: absolute;
  top: calc(100% + ${tkn('spacing.xs')});
  inset-inline-end: 0;
  z-index: ${tkn('zIndex.dropdown')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.lg')};
`;

export const Body = styled.div<{ $mobile: boolean }>`
  display: flex;
  flex-direction: ${({ $mobile }) => ($mobile ? 'column' : 'row')};
`;

export const Presets = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 12rem;
  padding: ${tkn('spacing.sm')};
  border-inline-end: 0.0625rem solid ${tkn('colors.border.primary')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    border-inline-end: none;
    border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

export const PresetButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border: none;
  border-radius: ${tkn('radius.md')};
  background: transparent;
  text-align: start;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.text.primary)};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const Custom = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
`;

export const CustomHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Nav = styled.div`
  display: flex;
  gap: ${tkn('spacing.2xs')};
`;

export const Months = styled.div`
  display: flex;
  gap: ${tkn('spacing.lg')};
`;

export const Month = styled.div`
  width: 16rem;
  max-width: 100%;
`;

export const MonthTitle = styled.span`
  display: block;
  margin-bottom: ${tkn('spacing.sm')};
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.base')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  text-transform: capitalize;
`;

export const NavButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  border-radius: ${tkn('radius.md')};
  background: transparent;
  color: ${tkn('colors.text.secondary')};
  cursor: pointer;

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: ${tkn('spacing.2xs')};
`;

export const Weekday = styled.span`
  text-align: center;
  padding: ${tkn('spacing.xs')} 0;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;

export const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;

/* Bottom sheet (phones) — mirrors Select's. */
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
  z-index: ${tkn('zIndex.modal')};
  display: flex;
  align-items: flex-end;
`;

export const Sheet = styled.div`
  width: 100%;
  max-height: 85vh;
  overflow-y: auto;
  background: ${tkn('colors.surface.primary')};
  border-top-left-radius: ${tkn('radius.xl')};
  border-top-right-radius: ${tkn('radius.xl')};
`;

export const SheetHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const Day = styled.button<{ $muted: boolean; $edge: boolean; $inRange: boolean; $today: boolean }>`
  height: 2.25rem;
  padding: 0;
  border: 0.0625rem solid
    ${({ $today, $edge, theme }) => ($today && !$edge ? theme.colors.brand.primary : 'transparent')};
  border-radius: ${tkn('radius.md')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  background: ${({ $edge, $inRange, theme }) =>
    $edge ? theme.colors.brand.primary : $inRange ? theme.colors.table.rowSelected : 'transparent'};
  color: ${({ $edge, $muted, theme }) =>
    $edge ? theme.colors.text.inverse : $muted ? theme.colors.text.tertiary : theme.colors.text.primary};
  visibility: ${({ $muted }) => ($muted ? 'hidden' : 'visible')};

  &:disabled {
    cursor: not-allowed;
    color: ${tkn('colors.text.tertiary')};
  }
`;
