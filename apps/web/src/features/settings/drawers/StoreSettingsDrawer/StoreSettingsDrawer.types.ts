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
  onToggleCheckBlacklist: (checked: boolean) => void;
  onAmazonTaxRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  onTrackingConversionScopeChange: (scope: TrackingConversionScope) => void;
  onTrackingConvertManualOrdersChange: (checked: boolean) => void;
}
