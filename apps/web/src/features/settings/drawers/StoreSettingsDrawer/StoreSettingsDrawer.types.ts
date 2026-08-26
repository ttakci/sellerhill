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
  zipCode: string;
  shipFromName: string;
  shipFromPhone: string;
  shipFromAddressLine1: string;
  shipFromAddressLine2: string;
  shipFromCity: string;
  /** The ship-from address feeds the user-level Aquiline profile, which is
   *  read from the GLOBAL store_settings row only — so the fields are
   *  editable in the global scope and replaced by an explanatory notice in
   *  a per-store scope, rather than offering a scope nothing consumes. */
  isGlobalScope: boolean;
  isShipFromAddressComplete: boolean;
  checkBlacklist: boolean;
  amazonTaxRate: number;
  autoFulfillEnabled: boolean;
  trackingConversionScope: TrackingConversionScope;
  trackingConvertManualOrders: boolean;
  buyerMessagingConfig: BuyerMessagingConfig;
  buyerMessageTemplates: BuyerMessageTemplate[];
  onToggleBuyerMessagingMaster: (enabled: boolean) => void;
  onToggleBuyerMessagingEvent: (event: BuyerMessageEventType, enabled: boolean) => void;
  onPickBuyerMessageTemplate: (event: BuyerMessageEventType, templateId: string) => void;
  onChangeBuyerMessageDelayDays: (event: BuyerMessageEventType, delayDays: number) => void;
  onCountryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShipFromNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShipFromPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShipFromAddressLine1Change: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShipFromAddressLine2Change: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShipFromCityChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleCheckBlacklist: (checked: boolean) => void;
  onAmazonTaxRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  onTrackingConversionScopeChange: (scope: TrackingConversionScope) => void;
  onTrackingConvertManualOrdersChange: (checked: boolean) => void;
}
