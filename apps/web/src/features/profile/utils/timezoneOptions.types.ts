export interface TimezoneOption {
  value: string;
  label: string;
}

export type SupportedValuesOf = (key: 'timeZone') => string[];
