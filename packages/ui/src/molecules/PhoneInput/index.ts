export { PhoneInput } from './PhoneInput.container';
export { PhoneInputInner } from './PhoneInput.component';
export type { PhoneInputProps, PhoneInputInnerProps } from './PhoneInput.types';
export {
  buildCountryOptions,
  flagEmoji,
  regionName,
  describe as describePhoneNumber,
  isValidPhone,
  toE164,
  DEFAULT_COUNTRY,
  type CountryOption,
  type CountryCode,
} from './phone.utils';
