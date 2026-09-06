import type {
  BuyerMessageEventType,
  BuyerMessagingConfig,
  BuyerMessageTemplate,
  StoreSettingsDrawerStep,
  TrackingConversionScope,
  StoreSettingsResponse,
} from '@repo/shared';

export interface StoreSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  availableStores: Array<{ id: string; name: string }>;
  storeConfigs: StoreSettingsResponse[];
  selectedScope: string;
  onSelectScope: (value: string) => void;
}

export interface StoreSettingsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  step: StoreSettingsDrawerStep;
  steps: Array<{ label: string }>;
  onBack: () => void;
  onContinue: () => void;
  isSaving: boolean;
  isContinueDisabled: boolean;
  scopeOptions: Array<{ value: string; label: string }>;
  selectedScope: string;
  onSelectScope: (value: string) => void;
  country: string;
  state: string;
  /** Wire name stays `shipFromCity` (the migration-089 column it persists to);
   *  it is the ONE location city now, feeding both the eBay inventory location
   *  and the tracking provider's seller profile. See `StoreSettings.shipFromCity`. */
  city: string;
  zipCode: string;
  /** All four location fields present. Gates the tracking-conversion toggle —
   *  the provider refuses a profile without a street/city/country, and eBay
   *  refuses a STORE location without the full set. */
  isAddressComplete: boolean;
  /**
   * Which of the four address fields are empty, but ONLY worth flagging once
   * the seller has tried to leave the step — computed by the container from
   * `isAddressComplete`'s same rule, surfaced per field so Continue produces a
   * real validation error under each blank field rather than a silent disable.
   */
  addressFieldErrors: { country: boolean; state: boolean; city: boolean; zipCode: boolean };
  checkBlacklist: boolean;
  amazonTaxRate: number;
  autoFulfillEnabled: boolean;
  /** Whether tracking numbers are converted at all. Maps to
   *  `tracking_conversion_provider` being `aquiline` rather than `local` —
   *  presented as one on/off choice because there is only ever one external
   *  provider, and naming vendors asks the seller to pick an implementation. */
  trackingConversionEnabled: boolean;
  trackingConversionScope: TrackingConversionScope;
  trackingConvertManualOrders: boolean;
  /**
   * True exactly when the seller's current choices let a RAW Amazon tracking
   * number reach eBay — the one outcome conversion exists to prevent, and one
   * eBay cannot undo (its Fulfillment API has no revise endpoint, so the first
   * number sent is what the buyer sees forever).
   *
   * These mirror the two `PASSTHROUGH_NOT_REQUIRED` exits in
   * `TrackingConversionService.resolveForOrder` that are the seller's OWN
   * choice. The carrier-scope choice is deliberately NOT one of them: on
   * `amazon_logistics_only` a TBA number is still converted, so it carries no
   * TBA exposure and warning about it would only train sellers to ignore red.
   */
  showConversionOffWarning: boolean;
  showManualExposureWarning: boolean;
  /**
   * Auto-ordering is off, so `auto_fulfill_status` can never be `placed` and
   * EVERY order is "linked by hand". Picks which of the two manual-exposure
   * warnings applies — partial exposure vs. total.
   */
  isEveryOrderManual: boolean;
  isConfirmingConversionOff: boolean;
  onConfirmConversionOff: () => void;
  onCancelConversionOff: () => void;
  isConfirmingManualOff: boolean;
  onConfirmManualOff: () => void;
  onCancelManualOff: () => void;
  buyerMessagingConfig: BuyerMessagingConfig;
  buyerMessageTemplates: BuyerMessageTemplate[];
  onToggleBuyerMessagingMaster: (enabled: boolean) => void;
  onToggleBuyerMessagingEvent: (event: BuyerMessageEventType, enabled: boolean) => void;
  onPickBuyerMessageTemplate: (event: BuyerMessageEventType, templateId: string) => void;
  onChangeBuyerMessageDelayDays: (event: BuyerMessageEventType, delayDays: number) => void;
  onCountryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleCheckBlacklist: (checked: boolean) => void;
  onAmazonTaxRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  onTrackingConversionEnabledChange: (enabled: boolean) => void;
  onTrackingConversionScopeChange: (scope: TrackingConversionScope) => void;
  onTrackingConvertManualOrdersChange: (checked: boolean) => void;
}
