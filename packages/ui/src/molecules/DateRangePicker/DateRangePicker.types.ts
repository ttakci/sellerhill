import type React from 'react';

export interface DateRangePickerPreset {
  value: string;
  label: string;
}

export interface DateRangePickerProps {
  presets: DateRangePickerPreset[];
  /** Highlighted preset, or null when a custom range is active. */
  selectedPreset: string | null;
  /** Current range (YYYY-MM-DD) — seeds the calendar. */
  from: string;
  to: string;
  /** Last selectable day (seller-local today). */
  maxDate: string;
  /** Text on the closed trigger, already composed ("Today · 7 Oct"). */
  triggerLabel: string;
  /** Heading of the custom section / bottom sheet title. */
  customLabel: string;
  applyLabel: string;
  cancelLabel: string;
  /** Accessible name of the popover. */
  dialogLabel: string;
  locale: string;
  onPresetSelect: (value: string) => void;
  onRangeApply: (from: string, to: string) => void;
  className?: string;
}

export interface DateRangePickerDay {
  iso: string;
  day: number;
  isCurrentMonth: boolean;
  isDisabled: boolean;
  isStart: boolean;
  isEnd: boolean;
  isInRange: boolean;
  isToday: boolean;
}

export interface DateRangePickerMonth {
  title: string;
  days: DateRangePickerDay[];
}

export interface DateRangePickerComponentProps {
  presets: DateRangePickerPreset[];
  selectedPreset: string | null;
  triggerLabel: string;
  customLabel: string;
  applyLabel: string;
  cancelLabel: string;
  dialogLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  weekdays: string[];
  months: DateRangePickerMonth[];
  canApply: boolean;
  isOpen: boolean;
  isMobile: boolean;
  className?: string;
  containerRef: React.RefObject<HTMLDivElement>;
  panelRef: React.RefObject<HTMLDivElement>;
  onToggle: () => void;
  onClose: () => void;
  onPresetSelect: (value: string) => void;
  onDaySelect: (iso: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onApply: () => void;
}
