import React from 'react';

import * as S from './SegmentedControl.style';
import type { SegmentedControlProps } from './SegmentedControl.types';

export const SegmentedControl = ({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: SegmentedControlProps): React.ReactElement => {
  return (
    <S.SegmentedControlContainer $size={size} className={className}>
      {options.map((option) => (
        <S.SegmentButton
          key={option.value}
          $active={value === option.value}
          $size={size}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </S.SegmentButton>
      ))}
    </S.SegmentedControlContainer>
  );
};

SegmentedControl.displayName = 'SegmentedControl';
