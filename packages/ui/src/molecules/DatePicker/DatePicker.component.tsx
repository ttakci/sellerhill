import type React from 'react';

import { Icon } from '../../atoms/Icon';

import * as S from './DatePicker.style';
import type { DatePickerComponentProps } from './DatePicker.types';

export const DatePickerComponent = ({
  label,
  clearLabel,
  size,
  fullWidth,
  className,
  isOpen,
  hasValue,
  displayValue,
  monthTitle,
  previousMonthLabel,
  nextMonthLabel,
  weekdays,
  days,
  containerRef,
  onToggle,
  onClear,
  onPreviousMonth,
  onNextMonth,
  onSelectDay,
}: DatePickerComponentProps): React.ReactElement => (
  <S.Container ref={containerRef} $fullWidth={fullWidth} className={className}>
    <S.Field
      type="button"
      $size={size}
      $isOpen={isOpen}
      $fullWidth={fullWidth}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <S.FieldText>
        <S.FieldLabel>{label}</S.FieldLabel>
        <S.FieldValue>{displayValue || ' '}</S.FieldValue>
      </S.FieldText>
      <Icon name="calendar-today" size={18} color="text.tertiary" />
    </S.Field>

    {hasValue && (
      <S.ClearButton type="button" aria-label={clearLabel} onClick={onClear}>
        <Icon name="x" size={14} color="text.secondary" />
      </S.ClearButton>
    )}

    {isOpen && (
      <S.Panel role="dialog" aria-label={label}>
        <S.PanelHeader>
          <S.NavButton type="button" aria-label={previousMonthLabel} onClick={onPreviousMonth}>
            <Icon name="chevron-left" size={18} />
          </S.NavButton>
          <S.MonthTitle>{monthTitle}</S.MonthTitle>
          <S.NavButton type="button" aria-label={nextMonthLabel} onClick={onNextMonth}>
            <Icon name="chevron-right" size={18} />
          </S.NavButton>
        </S.PanelHeader>
        <S.Grid>
          {weekdays.map((weekday) => (
            <S.Weekday key={weekday}>{weekday}</S.Weekday>
          ))}
          {days.map((day) => (
            <S.Day
              key={day.iso}
              type="button"
              $muted={!day.isCurrentMonth}
              $selected={day.isSelected}
              $today={day.isToday}
              aria-pressed={day.isSelected}
              onClick={() => onSelectDay(day.iso)}
            >
              {day.day}
            </S.Day>
          ))}
        </S.Grid>
      </S.Panel>
    )}
  </S.Container>
);

DatePickerComponent.displayName = 'DatePickerComponent';
