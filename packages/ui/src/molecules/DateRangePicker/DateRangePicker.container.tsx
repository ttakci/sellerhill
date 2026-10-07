import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { buildMonthGrid, firstDayOfWeek } from '../DatePicker/monthGrid';

import { DateRangePickerComponent } from './DateRangePicker.component';
import type { DateRangePickerDay, DateRangePickerMonth, DateRangePickerProps } from './DateRangePicker.types';

/** Same threshold as Select/Dropdown's bottom sheet. */
const MOBILE_MAX_WIDTH_PX = 640;

const viewOf = (iso: string) => ({ year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) - 1 });

export const DateRangePicker = ({
  presets,
  selectedPreset,
  from,
  to,
  maxDate,
  triggerLabel,
  customLabel,
  applyLabel,
  cancelLabel,
  dialogLabel,
  locale,
  onPresetSelect,
  onRangeApply,
  className,
}: DateRangePickerProps): React.ReactElement => {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < MOBILE_MAX_WIDTH_PX
  );
  // Draft selection: start set on the first click, end on the second.
  const [draftStart, setDraftStart] = useState<string | null>(null);
  const [draftEnd, setDraftEnd] = useState<string | null>(null);
  // Left month shown; desktop shows it and the next one, mobile one month.
  const [view, setView] = useState(() => viewOf(to));

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_MAX_WIDTH_PX);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
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
    const f = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    // 2023-01-01 was a Sunday.
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(2023, 0, 1 + ((weekStart + i) % 7))));
  }, [locale, weekStart]);
  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);

  const start = draftStart ?? from;
  const end = draftStart ? draftEnd : to;

  const months = useMemo<DateRangePickerMonth[]>(() => {
    const count = isMobile ? 1 : 2;
    return Array.from({ length: count }, (_, offset) => {
      const first = new Date(view.year, view.month + offset, 1);
      const grid = buildMonthGrid(first.getFullYear(), first.getMonth(), weekStart);
      const days: DateRangePickerDay[] = grid.map((cell) => ({
        ...cell,
        isDisabled: cell.iso > maxDate,
        isStart: cell.iso === start,
        isEnd: end !== null && cell.iso === end,
        isInRange: end !== null && cell.iso > start && cell.iso < end,
        isToday: cell.iso === maxDate,
      }));
      return { title: monthFormatter.format(first), days };
    });
  }, [isMobile, view, weekStart, maxDate, start, end, monthFormatter]);

  const shiftMonth = useCallback((delta: number) => {
    setView((prev) => {
      const next = new Date(prev.year, prev.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }, []);

  const resetDraft = () => {
    setDraftStart(null);
    setDraftEnd(null);
  };

  const handleToggle = () => {
    if (!isOpen) {
      resetDraft();
      // Desktop: the right-hand month is the one holding `to`.
      const v = viewOf(to);
      const shown = isMobile ? new Date(v.year, v.month, 1) : new Date(v.year, v.month - 1, 1);
      setView({ year: shown.getFullYear(), month: shown.getMonth() });
    }
    setIsOpen((open) => !open);
  };

  const handleDaySelect = (iso: string) => {
    if (iso > maxDate) {
      return;
    }
    if (!draftStart || draftEnd) {
      setDraftStart(iso);
      setDraftEnd(null);
      return;
    }
    if (iso < draftStart) {
      setDraftEnd(draftStart);
      setDraftStart(iso);
    } else {
      setDraftEnd(iso);
    }
  };

  const monthLabel = (delta: number) => monthFormatter.format(new Date(view.year, view.month + delta, 1));

  return (
    <DateRangePickerComponent
      presets={presets}
      selectedPreset={draftStart ? null : selectedPreset}
      triggerLabel={triggerLabel}
      customLabel={customLabel}
      applyLabel={applyLabel}
      cancelLabel={cancelLabel}
      dialogLabel={dialogLabel}
      previousMonthLabel={monthLabel(-1)}
      nextMonthLabel={monthLabel(1)}
      weekdays={weekdays}
      months={months}
      canApply={Boolean(draftStart && draftEnd)}
      isOpen={isOpen}
      isMobile={isMobile}
      className={className}
      containerRef={containerRef}
      panelRef={panelRef}
      onToggle={handleToggle}
      onClose={() => setIsOpen(false)}
      onPresetSelect={(value) => {
        onPresetSelect(value);
        setIsOpen(false);
      }}
      onDaySelect={handleDaySelect}
      onPreviousMonth={() => shiftMonth(-1)}
      onNextMonth={() => shiftMonth(1)}
      onApply={() => {
        if (draftStart && draftEnd) {
          onRangeApply(draftStart, draftEnd);
          setIsOpen(false);
        }
      }}
    />
  );
};

DateRangePicker.displayName = 'DateRangePicker';
