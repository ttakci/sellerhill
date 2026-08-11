import type { ListingSettingsGroupFormData } from '@repo/shared';
import type { Control } from 'react-hook-form';

export interface PriceCalculatorSectionProps {
  /** Reads the group form's LIVE (unsaved) repricingStrategy + fees. */
  control: Control<ListingSettingsGroupFormData>;
}

/** One line of the "how we got this price" breakdown — already formatted, container-built. */
export interface PriceBreakdownRow {
  label: string;
  value: string;
  /** Bold/emphasized row (the final price). */
  emphasis?: boolean;
}

export interface PriceCalculatorSectionComponentProps {
  amazonPriceInput: string;
  onAmazonPriceChange: (value: string) => void;
  onCalculate: () => void;
  isCalculateDisabled: boolean;
  breakdown: PriceBreakdownRow[];
}
