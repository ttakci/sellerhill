import React from 'react';

import { Select } from '../Select';
import { TextInput } from '../TextInput';

import * as S from './PhoneInput.style';
import type { PhoneInputInnerProps } from './PhoneInput.types';

export const PhoneInputInner: React.FC<PhoneInputInnerProps> = ({
  name,
  label,
  countryLabel,
  errorMessage,
  isDisabled,
  searchPlaceholder,
  noResultsMessage,
  country,
  displayValue,
  countryOptions,
  onCountryChange,
  onNumberChange,
  onNumberBlur,
}) => {
  return (
    <S.Stack>
      <Select
        label={countryLabel}
        options={countryOptions}
        value={country}
        onChange={onCountryChange}
        isSearchable
        isDisabled={isDisabled}
        size="medium"
        fullWidth
        searchPlaceholder={searchPlaceholder}
        noResultsMessage={noResultsMessage}
      />
      <TextInput
        name={name}
        type="tel"
        label={label}
        value={displayValue}
        onChange={onNumberChange}
        onBlur={onNumberBlur}
        errorMessage={errorMessage}
        isDisabled={isDisabled}
      />
    </S.Stack>
  );
};

PhoneInputInner.displayName = 'PhoneInputInner';
