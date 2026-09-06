import React, { useMemo, useState } from 'react';

import { DEFAULT_COUNTRY, buildCountryOptions, describe, formatAsTyped, toE164, type CountryCode } from './phone.utils';
import { PhoneInputInner } from './PhoneInput.component';
import type { PhoneInputProps } from './PhoneInput.types';

/** E.164 caps the whole number (country code + national) at 15 digits. */
const MAX_NATIONAL_DIGITS = 15;

export const PhoneInput: React.FC<PhoneInputProps> = ({
  name,
  label,
  countryLabel,
  value,
  onChange,
  onBlur,
  errorMessage,
  isDisabled,
  defaultCountry,
  locale = 'en',
  searchPlaceholder,
  noResultsMessage,
}) => {
  const countryOptions = useMemo(() => buildCountryOptions(locale), [locale]);

  // Source of truth is (country, nationalDigits) — RAW digits, never formatted
  // text. The display string is derived fresh every render, so `AsYouType` is
  // only ever fed clean digits and can't drift by re-consuming its own output.
  const initial = describe(value);
  const [country, setCountry] = useState<CountryCode>(
    initial.country ?? defaultCountry ?? DEFAULT_COUNTRY
  );
  const [nationalDigits, setNationalDigits] = useState<string>(initial.nationalNumber);

  // Re-hydrate on an EXTERNAL value change (drawer (re)open, form reset). The
  // echo of our own onChange is skipped — `value` then equals what our current
  // (country, digits) already emits.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== toE164(country, nationalDigits)) {
      const next = describe(value);
      setCountry(next.country ?? defaultCountry ?? DEFAULT_COUNTRY);
      setNationalDigits(next.nationalNumber);
    }
  }

  const displayValue = formatAsTyped(country, nationalDigits);

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;

    // A pasted international number brings its own country — adopt it.
    if (raw.trimStart().startsWith('+')) {
      const parsed = describe(raw);
      if (parsed.country) {
        setCountry(parsed.country);
        setNationalDigits(parsed.nationalNumber);
        onChange(toE164(parsed.country, parsed.nationalNumber));
        return;
      }
    }

    const digits = raw.replace(/\D/g, '').slice(0, MAX_NATIONAL_DIGITS);
    setNationalDigits(digits);
    onChange(toE164(country, digits));
  };

  const handleCountryChange = (nextValue: string | number): void => {
    const nextCountry = String(nextValue) as CountryCode;
    setCountry(nextCountry);
    onChange(toE164(nextCountry, nationalDigits));
  };

  const handleNumberBlur = (): void => {
    onBlur?.();
  };

  return (
    <PhoneInputInner
      name={name}
      label={label}
      countryLabel={countryLabel}
      errorMessage={errorMessage}
      isDisabled={isDisabled}
      searchPlaceholder={searchPlaceholder}
      noResultsMessage={noResultsMessage}
      country={country}
      displayValue={displayValue}
      countryOptions={countryOptions}
      onCountryChange={handleCountryChange}
      onNumberChange={handleNumberChange}
      onNumberBlur={handleNumberBlur}
    />
  );
};

PhoneInput.displayName = 'PhoneInput';
