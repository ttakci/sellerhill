import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DatePickerComponent } from './DatePicker.component';
import type { DatePickerDay, DatePickerProps } from './DatePicker.types';

const pad = (n: number): string => String(n).padStart(2, '0');
const toIso = (year: number, month: number, day: number): string => `${year}-${pad(month + 1)}-${pad(day)}`;

/** Parses `yyyy-mm-dd`; anything else is "no date". */
const parseIso = (value: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
};

/** 0 = Sunday … 6 = Saturday. Uses the locale's own week start when the runtime exposes it. */
const firstDayOfWeek = (locale: string): number => {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: { firstDay: number };
      getWeekInfo?: () => { firstDay: number };
    };
    const info = intlLocale.getWeekInfo?.() ?? intlLocale.weekInfo;
    if (info) {
      return info.firstDay % 7; // Intl: 1 = Monday … 7 = Sunday
    }
  } catch {
    // fall through to the default below
  }
  const lower = locale.toLowerCase();
  return lower === 'en' || lower.startsWith('en-us') ? 0 : 1;
};

export const DatePicker = ({
  value,
  onChange,
  label,
  locale,
  clearLabel,
  size = 'medium',
  fullWidth = true,
  className,
}: DatePickerProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const selected = useMemo(() => parseIso(value), [value]);
  const [view, setView] = useState(() => {
    const now = new Date();
    return { year: selected?.year ?? now.getFullYear(), month: selected?.month ?? now.getMonth() };
  });

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const weekStart = useMemo(() => firstDayOfWeek(locale), [locale]);

  const weekdays = useMemo(() => {
    const formatter = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));
  }, [locale, weekStart]);

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);

  const days = useMemo<DatePickerDay[]>(() => {
    const now = new Date();
    const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate());
    const lead = (new Date(view.year, view.month, 1).getDay() - weekStart + 7) % 7;
    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(view.year, view.month, 1 - lead + i);
      const iso = toIso(date.getFullYear(), date.getMonth(), date.getDate());
      return {
        iso,
        day: date.getDate(),
        isCurrentMonth: date.getMonth() === view.month,
        isSelected: iso === value,
        isToday: iso === todayIso,
      };
    });
  }, [view, weekStart, value]);

  const displayValue = useMemo(
    () =>
      selected
        ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(selected.year, selected.month, selected.day)
          )
        : '',
    [selected, locale]
  );

  const shiftMonth = useCallback((delta: number) => {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }, []);

  const monthLabel = (delta: number) => monthFormatter.format(new Date(view.year, view.month + delta, 1));

  return (
    <DatePickerComponent
      label={label}
      clearLabel={clearLabel}
      size={size}
      fullWidth={fullWidth}
      className={className}
      isOpen={isOpen}
      hasValue={Boolean(selected)}
      displayValue={displayValue}
      monthTitle={monthFormatter.format(new Date(view.year, view.month, 1))}
      previousMonthLabel={monthLabel(-1)}
      nextMonthLabel={monthLabel(1)}
      weekdays={weekdays}
      days={days}
      containerRef={containerRef}
      onToggle={() => {
        // Opening lands on the selected month.
        if (!isOpen && selected) {
          setView({ year: selected.year, month: selected.month });
        }
        setIsOpen((open) => !open);
      }}
      onClear={() => {
        onChange('');
        setIsOpen(false);
      }}
      onPreviousMonth={() => shiftMonth(-1)}
      onNextMonth={() => shiftMonth(1)}
      onSelectDay={(iso) => {
        onChange(iso);
        setIsOpen(false);
      }}
    />
  );
};

DatePicker.displayName = 'DatePicker';
