import type { CountryOption, CountryCode } from './phone.utils';

export interface PhoneInputProps {
  /** Field name for the underlying text input. */
  name: string;
  /** Floating label on the number input. */
  label?: string;
  /** Floating label on the country picker. */
  countryLabel?: string;
  /** Stored value — canonical E.164 (`+905321234567`) or '' when unset. */
  value: string;
  /** Emits canonical E.164, or '' while the number isn't parseable / is empty. */
  onChange: (e164: string) => void;
  onBlur?: () => void;
  /** Manual validation message (shown on the number input). */
  errorMessage?: string;
  isDisabled?: boolean;
  /** Country pre-selected when `value` carries no country of its own. */
  defaultCountry?: CountryCode;
  /** Locale for country names + option sort (defaults to 'en'). */
  locale?: string;
  /** Country-picker search box placeholder. */
  searchPlaceholder?: string;
  /** Country-picker "no matches" text. */
  noResultsMessage?: string;
}

export interface PhoneInputInnerProps {
  name: string;
  label?: string;
  countryLabel?: string;
  errorMessage?: string;
  isDisabled?: boolean;
  searchPlaceholder?: string;
  noResultsMessage?: string;
  /** State from container */
  country: CountryCode;
  displayValue: string;
  countryOptions: CountryOption[];
  /** Handlers from container */
  onCountryChange: (value: string | number) => void;
  onNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onNumberBlur: () => void;
}
