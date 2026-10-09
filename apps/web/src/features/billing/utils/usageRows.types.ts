export interface BillingUsageRow {
  /** Short text inside the ring, e.g. "100%". Separate from `ofDisplay` so the
   *  ring shows proportion and the text beside it shows the real figures. */
  ringLabel: string;
  labelKey: string;
  usedDisplay: string;
  ofDisplay: string;
  /** The ceiling alone ("20.000"), or the localized "Unlimited". */
  limitDisplay: string;
  /** "19.662 left" — null for an unlimited or disabled meter. */
  remainingDisplay: string | null;
  isUnlimited: boolean;
  barValue: number;
  barVariant: 'default' | 'success' | 'warning' | 'error';
  barAriaLabel: string;
}
