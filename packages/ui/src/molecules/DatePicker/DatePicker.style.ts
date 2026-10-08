import styled from '@emotion/styled';

import {
  CONTROL_BORDER_COLOR_PATH,
  CONTROL_PADDING_X,
  controlHeight,
  type ControlSize,
} from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

export const Container = styled.div<{ $fullWidth: boolean }>`
  position: relative;
  box-sizing: border-box;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
`;

/** The closed control — read-only; the date can only be chosen from the calendar. */
export const Field = styled.button<{ $size: ControlSize; $isOpen: boolean; $fullWidth: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  box-sizing: border-box;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  height: ${({ $size }) => controlHeight($size, true)};
  padding: 0 ${CONTROL_PADDING_X};
  text-align: start;
  cursor: pointer;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid
    ${({ $isOpen, theme }) => ($isOpen ? theme.colors.brand.primary : tkn(CONTROL_BORDER_COLOR_PATH)({ theme }))};
  border-radius: ${tkn('radius.md')};
  transition: border-color ${tkn('transitions.fast')};

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const FieldText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const FieldLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const FieldValue = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.base')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.tight')};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** Sits beside the calendar icon, so it never moves the label. */
export const ClearButton = styled.button`
  position: absolute;
  top: 50%;
  inset-inline-end: 2.75rem;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.background.tertiary')};
  cursor: pointer;
`;

/**
 * Portaled to `document.body` and placed by the container (top/left measured
 * from the field): inside a drawer the field sits in an `overflow: hidden`
 * glass card, which clipped an in-flow panel and let the next card paint over it.
 */
export const Panel = styled.div`
  position: fixed;
  z-index: ${tkn('zIndex.popover')};
  box-sizing: border-box;
  width: 18rem; /* until measured; then the field's width */
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('shadows.lg')};
`;

export const PanelHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${tkn('spacing.sm')};
`;

export const MonthTitle = styled.span`
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

export const Day = styled.button<{ $muted: boolean; $selected: boolean; $today: boolean }>`
  height: 2.25rem;
  padding: 0;
  border: 0.0625rem solid
    ${({ $today, $selected, theme }) => ($today && !$selected ? theme.colors.brand.primary : 'transparent')};
  border-radius: ${tkn('radius.md')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  background: ${({ $selected, theme }) => ($selected ? theme.colors.brand.primary : 'transparent')};
  color: ${({ $selected, $muted, theme }) =>
    $selected ? theme.colors.text.inverse : $muted ? theme.colors.text.tertiary : theme.colors.text.primary};

  &:hover {
    background: ${({ $selected, theme }) =>
      $selected ? theme.colors.brand.primary : theme.colors.background.tertiary};
  }
`;
