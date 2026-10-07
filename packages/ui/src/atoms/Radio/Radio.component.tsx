import React from 'react';

import * as S from './Radio.style';
import type { RadioProps } from './Radio.types';

/** One option of a single choice. Stateless: the caller holds which value is selected. */
export const Radio = ({ checked, onChange, value, name, label, disabled, id, className }: RadioProps) => (
  <S.Container $disabled={disabled} className={className}>
    <S.HiddenRadio
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={() => onChange(value)}
      disabled={disabled}
      id={id}
    />
    <S.StyledRadio $checked={checked} />
    <S.Label>{label}</S.Label>
  </S.Container>
);

Radio.displayName = 'Radio';
