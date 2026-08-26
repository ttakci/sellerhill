import {
  BuyerMessageEventConfig,
  BuyerMessageEventType,
  BuyerMessagingConfig,
  BuyerMessageTemplate,
  BuyerMessageTemplateKind,
  BuyerMessageTemplateRef,
  StoreSettingsDrawerStep,
  TrackingConversionProvider,
  TrackingConversionScope,
} from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { StoreSettingsDrawerComponent } from './StoreSettingsDrawer.component';
import type { StoreSettingsDrawerProps } from './StoreSettingsDrawer.types';

import { useGetBuyerMessageTemplatesQuery } from '@/features/buyer-messaging/api/buyer-messaging.api';
import { useGetBuyerMessagingConfigQuery, useSaveStoreSettingsMutation, useUpdateBuyerMessagingConfigMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const buildDefaultBuyerMessagingConfig = (templates: BuyerMessageTemplate[]): BuyerMessagingConfig => {
  const templateFor = (event: BuyerMessageEventType): BuyerMessageTemplateRef => {
    const match = templates.find((template) => template.eventType === event && template.isDefault)
      ?? templates.find((template) => template.eventType === event);
    return { kind: BuyerMessageTemplateKind.CUSTOM, id: match?.id ?? '' };
  };

  return {
    enabled: false,
    events: {
      [BuyerMessageEventType.ORDER_RECEIVED]: { enabled: false, template: templateFor(BuyerMessageEventType.ORDER_RECEIVED) },
      [BuyerMessageEventType.SHIPPED]: { enabled: false, template: templateFor(BuyerMessageEventType.SHIPPED) },
      [BuyerMessageEventType.DELIVERED]: { enabled: false, template: templateFor(BuyerMessageEventType.DELIVERED) },
      [BuyerMessageEventType.FEEDBACK_REQUEST]: {
        enabled: false,
        template: templateFor(BuyerMessageEventType.FEEDBACK_REQUEST),
        delayDays: 3,
      },
    },
  };
};

export const StoreSettingsDrawer: React.FC<StoreSettingsDrawerProps> = ({
  isOpen,
  onClose,
  availableStores,
  storeConfigs,
  selectedScope,
  onSelectScope,
}) => {
  const { t } = useTranslation(['translation']);
  const { showMessage, closeMessage } = useUI();
  const storeId = selectedScope === GLOBAL_SCOPE ? undefined : selectedScope;
  const config = resolveScopeConfig(storeConfigs, selectedScope);

  const { data: remoteBuyerMessaging } = useGetBuyerMessagingConfigQuery({ storeId });
  const { data: buyerMessageTemplatesData } = useGetBuyerMessageTemplatesQuery();
  const buyerMessageTemplates = useMemo(() => buyerMessageTemplatesData ?? [], [buyerMessageTemplatesData]);
  const [saveSettings, { isLoading: isSavingSettings }] = useSaveStoreSettingsMutation();
  const [updateBuyerMessaging, { isLoading: isSavingMessaging }] = useUpdateBuyerMessagingConfigMutation();
  const isSaving = isSavingSettings || isSavingMessaging;
  useLoading(isSaving);

  const [step, setStep] = useState(StoreSettingsDrawerStep.GENERAL);
  const [country, setCountry] = useState(config?.country ?? '');
  const [stateField, setStateField] = useState(config?.state ?? '');
  const [zipCode, setZipCode] = useState(config?.zipCode ?? '');
  const [shipFromName, setShipFromName] = useState(config?.shipFromName ?? '');
  const [shipFromPhone, setShipFromPhone] = useState(config?.shipFromPhone ?? '');
  const [shipFromAddressLine1, setShipFromAddressLine1] = useState(config?.shipFromAddressLine1 ?? '');
  const [shipFromAddressLine2, setShipFromAddressLine2] = useState(config?.shipFromAddressLine2 ?? '');
  const [shipFromCity, setShipFromCity] = useState(config?.shipFromCity ?? '');
  const [checkBlacklist, setCheckBlacklist] = useState(config?.checkBlacklist ?? true);
  const [amazonTaxRate, setAmazonTaxRate] = useState(config?.amazonTaxRate ?? 0);
  const [autoFulfillEnabled, setAutoFulfillEnabled] = useState(config?.autoFulfillEnabled ?? false);
  const [trackingConversionScope, setTrackingConversionScope] = useState<TrackingConversionScope>(
    config?.trackingConversionScope ?? TrackingConversionScope.AMAZON_LOGISTICS_ONLY
  );
  const [trackingConvertManualOrders, setTrackingConvertManualOrders] = useState(
    config?.trackingConvertManualOrders ?? true
  );
  const [buyerMessagingConfig, setBuyerMessagingConfig] = useState<BuyerMessagingConfig>(() =>
    remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));

  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevScope, setPrevScope] = useState(selectedScope);
  const [prevRemoteBuyerMessaging, setPrevRemoteBuyerMessaging] = useState(remoteBuyerMessaging);
  const [prevBuyerMessageTemplates, setPrevBuyerMessageTemplates] = useState(buyerMessageTemplates);
  if (
    isOpen !== prevOpen
    || selectedScope !== prevScope
    || remoteBuyerMessaging !== prevRemoteBuyerMessaging
    || buyerMessageTemplates !== prevBuyerMessageTemplates
  ) {
    const didOpen = isOpen && !prevOpen;
    const scopeChanged = selectedScope !== prevScope;
    setPrevOpen(isOpen);
    setPrevScope(selectedScope);
    setPrevRemoteBuyerMessaging(remoteBuyerMessaging);
    setPrevBuyerMessageTemplates(buyerMessageTemplates);

    if (isOpen && (didOpen || scopeChanged)) {
      const next = resolveScopeConfig(storeConfigs, selectedScope);
      setStep(StoreSettingsDrawerStep.GENERAL);
      setCountry(next?.country ?? '');
      setStateField(next?.state ?? '');
      setZipCode(next?.zipCode ?? '');
      setShipFromName(next?.shipFromName ?? '');
      setShipFromPhone(next?.shipFromPhone ?? '');
      setShipFromAddressLine1(next?.shipFromAddressLine1 ?? '');
      setShipFromAddressLine2(next?.shipFromAddressLine2 ?? '');
      setShipFromCity(next?.shipFromCity ?? '');
      setCheckBlacklist(next?.checkBlacklist ?? true);
      setAmazonTaxRate(next?.amazonTaxRate ?? 0);
      setAutoFulfillEnabled(next?.autoFulfillEnabled ?? false);
      setTrackingConversionScope(
        next?.trackingConversionScope ?? TrackingConversionScope.AMAZON_LOGISTICS_ONLY
      );
      setTrackingConvertManualOrders(next?.trackingConvertManualOrders ?? true);
      setBuyerMessagingConfig(remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
    } else if (isOpen && step === StoreSettingsDrawerStep.GENERAL) {
      setBuyerMessagingConfig(remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
    }
  }

  // The ship-from address is a USER-level value: it feeds the Aquiline profile,
  // which `AquilineProfileService.resolveShipFromAddress` reads from the global
  // `store_settings` row only. A per-store copy has no consumer, so the drawer
  // must not offer a scope it cannot honour — the fields are shown in the
  // global scope and explained in a per-store one.
  const isGlobal = selectedScope === GLOBAL_SCOPE;

  const save = (): void => {
    void Promise.all([
      saveSettings({
        isGlobal,
        storeId,
        country: country.trim(),
        state: stateField.trim(),
        zipCode: zipCode.trim(),
        shipFromName: shipFromName.trim(),
        shipFromPhone: shipFromPhone.trim(),
        shipFromAddressLine1: shipFromAddressLine1.trim(),
        shipFromAddressLine2: shipFromAddressLine2.trim(),
        shipFromCity: shipFromCity.trim(),
        checkBlacklist,
        amazonTaxRate,
        autoFulfillEnabled,
        trackingConversionProvider: config?.trackingConversionProvider ?? TrackingConversionProvider.LOCAL,
        trackingConversionScope,
        trackingConvertManualOrders,
      }).unwrap(),
      updateBuyerMessaging({ config: buyerMessagingConfig, storeId }).unwrap(),
    ])
      .then(() => {
        showMessage({ type: 'success', headerKey: 'translation:message.success.header', descriptionKey: 'translation:common.saveSuccess' }, t);
        onClose();
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage({ type: 'error', headerKey: 'translation:message.error.header', descriptionKey: getErrorI18nKey(error), primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage } }, t);
      });
  };

  const handleContinue = (): void => {
    if (step === StoreSettingsDrawerStep.BLACKLIST) {
      save();
    } else {
      setStep((step + 1) as StoreSettingsDrawerStep);
    }
  };

  // Mirrors AquilineProfileService.resolveShipFromAddress: a profile is only
  // created/PATCHed once address_line1 + city + country are all present —
  // anything less and tracking conversion falls back to the raw Amazon
  // number, so the seller is told that here rather than discovering it later
  // as a silent pass-through.
  const isShipFromAddressComplete = Boolean(
    country.trim() && shipFromAddressLine1.trim() && shipFromCity.trim()
  );

  const updateEvent = (event: BuyerMessageEventType, update: (current: BuyerMessageEventConfig) => BuyerMessageEventConfig): void => {
    setBuyerMessagingConfig((current) => ({
      ...current,
      events: { ...current.events, [event]: update(current.events[event]!) },
    }));
  };

  return (
    <StoreSettingsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      step={step}
      steps={[
        { label: t('translation:settingsHub.drawer.storeSettings.steps.general') },
        { label: t('translation:settingsHub.drawer.storeSettings.steps.messaging') },
        { label: t('translation:settingsHub.drawer.storeSettings.steps.blacklist') },
      ]}
      onBack={() => setStep((step - 1) as StoreSettingsDrawerStep)}
      onContinue={handleContinue}
      isSaving={isSaving}
      isContinueDisabled={isSaving || (step === StoreSettingsDrawerStep.GENERAL && (!country.trim() || !stateField.trim() || !zipCode.trim()))}
      scopeOptions={buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'))}
      selectedScope={selectedScope}
      onSelectScope={onSelectScope}
      country={country}
      state={stateField}
      zipCode={zipCode}
      shipFromName={shipFromName}
      shipFromPhone={shipFromPhone}
      shipFromAddressLine1={shipFromAddressLine1}
      shipFromAddressLine2={shipFromAddressLine2}
      shipFromCity={shipFromCity}
      isGlobalScope={isGlobal}
      isShipFromAddressComplete={isShipFromAddressComplete}
      checkBlacklist={checkBlacklist}
      amazonTaxRate={amazonTaxRate}
      autoFulfillEnabled={autoFulfillEnabled}
      trackingConversionScope={trackingConversionScope}
      onTrackingConversionScopeChange={setTrackingConversionScope}
      trackingConvertManualOrders={trackingConvertManualOrders}
      onTrackingConvertManualOrdersChange={setTrackingConvertManualOrders}
      buyerMessagingConfig={buyerMessagingConfig}
      buyerMessageTemplates={buyerMessageTemplates}
      onToggleBuyerMessagingMaster={(enabled) => setBuyerMessagingConfig((current) => ({ ...current, enabled }))}
      onToggleBuyerMessagingEvent={(event, enabled) => updateEvent(event, (current) => ({ ...current, enabled }))}
      onPickBuyerMessageTemplate={(event, templateId) => updateEvent(event, (current) => ({ ...current, template: { kind: BuyerMessageTemplateKind.CUSTOM, id: templateId } }))}
      onChangeBuyerMessageDelayDays={(event, delayDays) => updateEvent(event, (current) => ({ ...current, delayDays }))}
      onCountryChange={(e) => setCountry(e.target.value)}
      onStateChange={(e) => setStateField(e.target.value)}
      onZipCodeChange={(e) => setZipCode(e.target.value)}
      onShipFromNameChange={(e) => setShipFromName(e.target.value)}
      onShipFromPhoneChange={(e) => setShipFromPhone(e.target.value)}
      onShipFromAddressLine1Change={(e) => setShipFromAddressLine1(e.target.value)}
      onShipFromAddressLine2Change={(e) => setShipFromAddressLine2(e.target.value)}
      onShipFromCityChange={(e) => setShipFromCity(e.target.value)}
      onToggleCheckBlacklist={setCheckBlacklist}
      onAmazonTaxRateChange={(e) => setAmazonTaxRate(Number(e.target.value) || 0)}
      onAutoFulfillEnabledChange={setAutoFulfillEnabled}
    />
  );
};

StoreSettingsDrawer.displayName = 'StoreSettingsDrawer';
