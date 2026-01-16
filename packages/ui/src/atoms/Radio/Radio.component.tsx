import React, { forwardRef } from 'react';
import * as S from './Radio.style';
import type { RadioProps } from './Radio.types';

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ checked, defaultChecked, onChange, label, disabled, value, name, id, className }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.checked);
      }
    };

    return (
      <S.Container $disabled={disabled} className={className}>
        <S.HiddenRadio
          type="radio"
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          disabled={disabled}
          value={value}
          name={name}
          id={id}
        />
        <S.StyledRadio $checked={checked || defaultChecked} $disabled={disabled} />
        {label && <S.Label>{label}</S.Label>}
      </S.Container>
    );
  }
);

Radio.displayName = 'Radio';
