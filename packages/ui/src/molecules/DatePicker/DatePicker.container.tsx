import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { DatePickerComponent } from './DatePicker.component';
import type { DatePickerDay, DatePickerPanelPosition, DatePickerProps } from './DatePicker.types';
import { buildMonthGrid, firstDayOfWeek, isoOf } from './monthGrid';

/** Gap between the field and the panel, and the panel's minimum inset from the viewport edge (px). */
const PANEL_GAP_PX = 4;
const VIEWPORT_INSET_PX = 8;
/** Narrowest calendar (18rem at the default 16px root). */
const PANEL_MIN_WIDTH_PX = 288;

/** Parses `yyyy-mm-dd`; anything else is "no date". */
const parseIso = (value: string): { year: number; month: number; day: number } | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
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
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<DatePickerPanelPosition | null>(null);
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

  /*
   * The panel is portaled to <body>, so it is placed from the field's viewport
   * rect. Measured every frame while open: a parent Drawer slides in with a CSS
   * transform, which fires neither `scroll` nor `resize`, and the drawer body
   * scrolls under the field. State is written only when the position changes.
   */
  useLayoutEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    let frameId = 0;
    let last: DatePickerPanelPosition | null = null;
    const update = () => {
      const field = containerRef.current;
      const panel = panelRef.current;
      if (field && panel) {
        const rect = field.getBoundingClientRect();
        const height = panel.offsetHeight;
        // Same width as the field, so the two edges line up; a narrow field
        // (a filter row) still gets a calendar wide enough to tap.
        const width = Math.min(Math.max(rect.width, PANEL_MIN_WIDTH_PX), window.innerWidth - 2 * VIEWPORT_INSET_PX);
        const roomBelow = window.innerHeight - rect.bottom;
        const openAbove = roomBelow < height + PANEL_GAP_PX && rect.top > roomBelow;
        const top = openAbove ? rect.top - PANEL_GAP_PX - height : rect.bottom + PANEL_GAP_PX;
        const rtl = window.getComputedStyle(field).direction === 'rtl';
        const preferredLeft = rtl ? rect.right - width : rect.left;
        const maxLeft = window.innerWidth - VIEWPORT_INSET_PX - width;
        const left = Math.max(VIEWPORT_INSET_PX, Math.min(preferredLeft, maxLeft));
        if (!last || last.top !== top || last.left !== left || last.width !== width) {
          last = { top, left, width };
          setPanelPosition(last);
        }
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => {
      cancelAnimationFrame(frameId);
      // The next opening starts hidden until it is measured again.
      setPanelPosition(null);
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
    const todayIso = isoOf(now.getFullYear(), now.getMonth(), now.getDate());
    return buildMonthGrid(view.year, view.month, weekStart).map((cell) => ({
      ...cell,
      isSelected: cell.iso === value,
      isToday: cell.iso === todayIso,
    }));
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
      panelRef={panelRef}
      panelPosition={panelPosition}
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
