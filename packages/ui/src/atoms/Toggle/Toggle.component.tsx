import React, { forwardRef } from 'react';

import * as S from './Toggle.style';
import type { ToggleProps } from './Toggle.types';

export const Toggle = forwardRef<HTMLInputElement, ToggleProps>(
  ({ checked, defaultChecked, onChange, label, disabled, name, id, className }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (onChange) {
        onChange(e.target.checked);
      }
    };

    return (
      <S.Container $disabled={disabled} className={className}>
        <S.HiddenCheckbox
          type="checkbox"
          ref={ref}
          checked={checked}
          defaultChecked={defaultChecked}
          onChange={handleChange}
          disabled={disabled}
          name={name}
          id={id}
        />
        <S.Switch $checked={checked || defaultChecked} $disabled={disabled} />
        {label && <S.Label>{label}</S.Label>}
      </S.Container>
    );
  }
);

Toggle.displayName = 'Toggle';
