import React, { forwardRef } from 'react';
import { Icon } from '../Icon';
import * as S from './Select.style';
import type { SelectProps } from './Select.types';

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, value, onChange, onBlur, placeholder, disabled, hasError, fullWidth = true, name, id, className }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (onChange) {
        onChange(e.target.value);
      }
    };

    return (
      <S.Container $fullWidth={fullWidth} className={className}>
        <S.StyledSelect
          ref={ref}
          value={value}
          onChange={handleChange}
          onBlur={onBlur}
          disabled={disabled}
          $hasError={hasError}
          $fullWidth={fullWidth}
          name={name}
          id={id}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </S.StyledSelect>
        <S.IconContainer>
          <Icon name="chevron-down" size={20} />
        </S.IconContainer>
      </S.Container>
    );
  }
);

Select.displayName = 'Select';
