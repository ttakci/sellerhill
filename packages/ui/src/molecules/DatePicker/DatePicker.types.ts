import type React from 'react';

import type { ControlSize } from '../../styles/formControl.types';

/** One cell of a six-week month grid. `iso` is `yyyy-mm-dd`. */
export interface MonthGridDay {
  iso: string;
  day: number;
  isCurrentMonth: boolean;
}

/** One cell of the month grid. `iso` is `yyyy-mm-dd`. */
export interface DatePickerDay {
  iso: string;
  day: number;
  isCurrentMonth: boolean;
  isSelected: boolean;
  isToday: boolean;
}

export interface DatePickerProps {
  /** Selected date as `yyyy-mm-dd`, or `''` for none. */
  value: string;
  /** Called with `yyyy-mm-dd`, or `''` when cleared. */
  onChange: (value: string) => void;
  /** Floating label (already translated). */
  label: string;
  /** BCP-47 locale for month / weekday names and the displayed value. */
  locale: string;
  /** Accessible name of the clear button (already translated). */
  clearLabel?: string;
  size?: ControlSize;
  fullWidth?: boolean;
  className?: string;
}

export interface DatePickerComponentProps {
  label: string;
  clearLabel?: string;
  size: ControlSize;
  fullWidth: boolean;
  className?: string;
  isOpen: boolean;
  hasValue: boolean;
  displayValue: string;
  monthTitle: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  weekdays: string[];
  days: DatePickerDay[];
  containerRef: React.RefObject<HTMLDivElement>;
  onToggle: () => void;
  onClear: () => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onSelectDay: (iso: string) => void;
}
