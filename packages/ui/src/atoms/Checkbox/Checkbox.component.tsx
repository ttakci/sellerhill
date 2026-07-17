import React, { forwardRef } from 'react';

import * as S from './Checkbox.style';
import type { CheckboxProps } from './Checkbox.types';

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, defaultChecked, onChange, label, disabled, name, id, className, 'aria-label': ariaLabel }, ref) => {
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
          aria-label={ariaLabel}
        />
        <S.StyledCheckbox $checked={checked || defaultChecked} $disabled={disabled} />
        {label && <S.Label>{label}</S.Label>}
      </S.Container>
    );
  }
);

Checkbox.displayName = 'Checkbox';
