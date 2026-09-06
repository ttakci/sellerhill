export interface BillingUsageRow {
  /** Short text inside the ring, e.g. "100%". Separate from `ofDisplay` so the
   *  ring shows proportion and the text beside it shows the real figures. */
  ringLabel: string;
  labelKey: string;
  usedDisplay: string;
  ofDisplay: string;
  barValue: number;
  barVariant: 'default' | 'success' | 'warning' | 'error';
  barAriaLabel: string;
}
