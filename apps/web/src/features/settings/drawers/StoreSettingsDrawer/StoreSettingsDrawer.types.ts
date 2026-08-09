import type {
  BuyerMessageEventType,
  BuyerMessagingConfig,
  BuyerMessageTemplate,
  StoreSettingsDrawerStep,
  StoreSettingsResponse,
} from '@repo/shared';

export type BlacklistScope = 'title' | 'description' | 'both';
export type BlacklistItem = { keyword: string; scope: BlacklistScope };

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
  validateTitle: boolean;
  validateDescription: boolean;
  amazonTaxRate: number;
  autoFulfillEnabled: boolean;
  buyerMessagingConfig: BuyerMessagingConfig;
  buyerMessageTemplates: BuyerMessageTemplate[];
  onToggleBuyerMessagingMaster: (enabled: boolean) => void;
  onToggleBuyerMessagingEvent: (event: BuyerMessageEventType, enabled: boolean) => void;
  onPickBuyerMessageTemplate: (event: BuyerMessageEventType, templateId: string) => void;
  onChangeBuyerMessageDelayDays: (event: BuyerMessageEventType, delayDays: number) => void;
  onCountryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onStateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onZipCodeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleValidateTitle: (checked: boolean) => void;
  onToggleValidateDescription: (checked: boolean) => void;
  onAmazonTaxRateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAutoFulfillEnabledChange: (checked: boolean) => void;
  keywords: string;
  onKeywordsChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  blacklistScope: BlacklistScope;
  onBlacklistScopeChange: (value: BlacklistScope) => void;
  onAddKeyword: () => void;
  blacklistError: string | null;
  blacklist: BlacklistItem[];
  onRemoveKeyword: (item: BlacklistItem) => void;
}
