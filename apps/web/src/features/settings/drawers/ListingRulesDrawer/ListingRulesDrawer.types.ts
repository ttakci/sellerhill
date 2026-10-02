import type { StoreSettingsResponse } from '@repo/shared';

export interface ListingRulesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
  /** Shared with the other store drawers, so they all edit the same scope. */
  selectedScope: string;
  onSelectScope: (value: string) => void;
}

export interface ListingRulesOption {
  value: string;
  label: string;
}

/** What to do with a listing that is not selling. */
export enum ColdListingMode {
  FLAG = 'flag',
  END = 'end',
}

export interface ListingRulesDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isSaving: boolean;

  scopeOptions: ListingRulesOption[];
  selectedScope: string;
  onSelectScope: (value: string) => void;

  // Brand protection
  veroProtectionEnabled: boolean;
  onVeroProtectionChange: (enabled: boolean) => void;
  hideBrand: boolean;
  onHideBrandChange: (enabled: boolean) => void;

  // What may be listed
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onMaxPriceChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  priceError?: string;
  amazonShippedOnly: boolean;
  onAmazonShippedOnlyChange: (enabled: boolean) => void;
  minRating: string;
  ratingOptions: ListingRulesOption[];
  onMinRatingChange: (value: string) => void;
  minReviewCount: string;
  onMinReviewCountChange: (e: React.ChangeEvent<HTMLInputElement>) => void;

  // Blocked ASINs
  blockedAsins: string;
  onBlockedAsinsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  blockedAsinCount: number;

  // Clean-up
  outOfStockEndDays: string;
  outOfStockOptions: ListingRulesOption[];
  onOutOfStockEndDaysChange: (value: string) => void;
  coldListingEnabled: boolean;
  onColdListingEnabledChange: (enabled: boolean) => void;
  coldListingDays: string;
  onColdListingDaysChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  coldListingDaysError?: string;
  coldListingMode: ColdListingMode;
  coldListingModeOptions: ListingRulesOption[];
  onColdListingModeChange: (value: string) => void;

  // Promoted Listings
  promotedEnabled: boolean;
  onPromotedEnabledChange: (enabled: boolean) => void;
  promotedAdRate: string;
  onPromotedAdRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  promotedAdRateError?: string;
  /** eBay says this store may not advertise yet; empty when eligible or unknown. */
  promotedIneligibleMessage: string;
}

/** The form's own state: every number field is the text the seller typed. */
export interface ListingRulesDraft {
  veroProtectionEnabled: boolean;
  hideBrand: boolean;
  minPrice: string;
  maxPrice: string;
  amazonShippedOnly: boolean;
  minRating: string;
  minReviewCount: string;
  blockedAsins: string;
  outOfStockEndDays: string;
  coldListingEnabled: boolean;
  coldListingDays: string;
  coldListingMode: ColdListingMode;
  promotedEnabled: boolean;
  promotedAdRate: string;
}
