import type React from 'react';
import { createPortal } from 'react-dom';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';

import * as S from './DateRangePicker.style';
import type { DateRangePickerComponentProps, DateRangePickerMonth } from './DateRangePicker.types';

export const DateRangePickerComponent = (props: DateRangePickerComponentProps): React.ReactElement => {
  const {
    presets,
    selectedPreset,
    triggerLabel,
    customLabel,
    applyLabel,
    cancelLabel,
    dialogLabel,
    previousMonthLabel,
    nextMonthLabel,
    weekdays,
    months,
    canApply,
    isOpen,
    isMobile,
    className,
    containerRef,
    panelRef,
    onToggle,
    onClose,
    onPresetSelect,
    onDaySelect,
    onPreviousMonth,
    onNextMonth,
    onApply,
  } = props;

  const renderMonth = (month: DateRangePickerMonth) => (
    <S.Month key={month.title}>
      <S.MonthTitle>{month.title}</S.MonthTitle>
      <S.Grid>
        {weekdays.map((weekday) => (
          <S.Weekday key={weekday}>{weekday}</S.Weekday>
        ))}
        {month.days.map((day) => (
          <S.Day
            key={day.iso}
            type="button"
            disabled={day.isDisabled}
            $muted={!day.isCurrentMonth}
            $edge={day.isStart || day.isEnd}
            $inRange={day.isInRange}
            $today={day.isToday}
            aria-pressed={day.isStart || day.isEnd}
            onClick={() => onDaySelect(day.iso)}
          >
            {day.isCurrentMonth ? day.day : ''}
          </S.Day>
        ))}
      </S.Grid>
    </S.Month>
  );

  const body = (
    <S.Body $mobile={isMobile}>
      <S.Presets $mobile={isMobile} role="listbox" aria-label={dialogLabel}>
        {presets.map((preset) => (
          <S.PresetButton
            key={preset.value}
            type="button"
            role="option"
            aria-selected={preset.value === selectedPreset}
            $active={preset.value === selectedPreset}
            onClick={() => onPresetSelect(preset.value)}
          >
            {preset.label}
            {preset.value === selectedPreset && <Icon name="check" size={16} color="brand.primary" />}
          </S.PresetButton>
        ))}
      </S.Presets>
      <S.Custom>
        <S.CustomHeader>
          <Text variant="body-sm" weight="semibold">
            {customLabel}
          </Text>
          <S.Nav>
            <S.NavButton type="button" aria-label={previousMonthLabel} onClick={onPreviousMonth}>
              <Icon name="chevron-left" size={18} />
            </S.NavButton>
            <S.NavButton type="button" aria-label={nextMonthLabel} onClick={onNextMonth}>
              <Icon name="chevron-right" size={18} />
            </S.NavButton>
          </S.Nav>
        </S.CustomHeader>
        <S.Months>{months.map(renderMonth)}</S.Months>
        <S.Actions>
          <Button variant="secondary" size="small" onClick={onClose}>
            <Text variant="body-sm">{cancelLabel}</Text>
          </Button>
          <Button variant="primary" size="small" disabled={!canApply} onClick={onApply}>
            <Text variant="body-sm" weight="semibold">
              {applyLabel}
            </Text>
          </Button>
        </S.Actions>
      </S.Custom>
    </S.Body>
  );

  return (
    <S.Container ref={containerRef} className={className}>
      <S.Trigger type="button" $isOpen={isOpen} aria-haspopup="dialog" aria-expanded={isOpen} onClick={onToggle}>
        <Icon name="calendar-today" size={18} color="text.secondary" />
        <S.TriggerText>{triggerLabel}</S.TriggerText>
        <Icon name="chevron-down" size={16} color="text.tertiary" />
      </S.Trigger>

      {isOpen && !isMobile && (
        <S.Panel ref={panelRef} role="dialog" aria-label={dialogLabel}>
          {body}
        </S.Panel>
      )}

      {isOpen &&
        isMobile &&
        createPortal(
          <S.Overlay onClick={onClose}>
            <S.Sheet ref={panelRef} role="dialog" aria-label={dialogLabel} onClick={(e) => e.stopPropagation()}>
              <S.SheetHeader>
                <Text variant="body" weight="semibold">
                  {dialogLabel}
                </Text>
                <S.NavButton type="button" aria-label={cancelLabel} onClick={onClose}>
                  <Icon name="x" size={18} />
                </S.NavButton>
              </S.SheetHeader>
              {body}
            </S.Sheet>
          </S.Overlay>,
          document.body
        )}
    </S.Container>
  );
};

DateRangePickerComponent.displayName = 'DateRangePickerComponent';
