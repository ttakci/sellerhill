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

import { notifyDrawerDone } from '../shared/notifyDrawerDone';
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

  const [step, setStep] = useState(StoreSettingsDrawerStep.ADDRESS);
  const [country, setCountry] = useState(config?.country ?? '');
  const [stateField, setStateField] = useState(config?.state ?? '');
  const [zipCode, setZipCode] = useState(config?.zipCode ?? '');
  const [city, setCity] = useState(config?.shipFromCity ?? '');
  const [checkBlacklist, setCheckBlacklist] = useState(config?.checkBlacklist ?? true);
  const [amazonTaxRate, setAmazonTaxRate] = useState(config?.amazonTaxRate ?? 0);
  const [autoFulfillEnabled, setAutoFulfillEnabled] = useState(config?.autoFulfillEnabled ?? false);
  // The provider is stored as an enum but presented as a single on/off choice:
  // `local` (send the Amazon number as-is) vs `aquiline` (convert it). Showing
  // the seller two vendor names would ask them to pick an implementation
  // instead of a behaviour, and there is only ever one external provider.
  const [trackingConversionEnabled, setTrackingConversionEnabled] = useState(
    (config?.trackingConversionProvider ?? TrackingConversionProvider.LOCAL) !==
      TrackingConversionProvider.LOCAL
  );
  const [trackingConversionScope, setTrackingConversionScope] = useState<TrackingConversionScope>(
    config?.trackingConversionScope ?? TrackingConversionScope.AMAZON_LOGISTICS_ONLY
  );
  const [trackingConvertManualOrders, setTrackingConvertManualOrders] = useState(
    config?.trackingConvertManualOrders ?? true
  );
  // Turning either of these OFF is what lets a raw Amazon tracking number
  // reach eBay, and eBay's Fulfillment API has no revise endpoint — the first
  // number sent is what the buyer sees forever. So the toggle does not flip on
  // click: it opens a confirmation and only the confirm actually writes.
  const [isConfirmingConversionOff, setIsConfirmingConversionOff] = useState(false);
  const [isConfirmingManualOff, setIsConfirmingManualOff] = useState(false);
  // Continue is never disabled for the address step — clicking it with a gap
  // is what SHOULD surface the validation, not a button the seller can't
  // figure out how to unlock. This flips true only after a first failed
  // attempt, so a fresh drawer never opens already showing red fields.
  const [addressSubmitAttempted, setAddressSubmitAttempted] = useState(false);
  const [buyerMessagingConfig, setBuyerMessagingConfig] = useState<BuyerMessagingConfig>(() =>
    remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));

  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [prevScope, setPrevScope] = useState(selectedScope);
  const [prevConfig, setPrevConfig] = useState(config);
  const [prevRemoteBuyerMessaging, setPrevRemoteBuyerMessaging] = useState(remoteBuyerMessaging);
  const [prevBuyerMessageTemplates, setPrevBuyerMessageTemplates] = useState(buyerMessageTemplates);
  if (
    isOpen !== prevOpen
    || selectedScope !== prevScope
    || config !== prevConfig
    || remoteBuyerMessaging !== prevRemoteBuyerMessaging
    || buyerMessageTemplates !== prevBuyerMessageTemplates
  ) {
    const didOpen = isOpen && !prevOpen;
    const scopeChanged = selectedScope !== prevScope;
    // The drawer is always mounted and `isOpen` is a prop, so a deep link
    // (`/settings?drawer=storeSettings`) has it TRUE on the very first render —
    // before the settings query resolves. `didOpen` is therefore false, the
    // form initialises from an empty config, and nothing ever re-syncs it: the
    // seller sees a blank address they have actually saved. Harmless while
    // every field was optional; now it also disables Continue and shows the
    // "all four are required" warning to someone who is already complete.
    //
    // Adopting the config only on the null -> loaded transition is what keeps
    // this from clobbering edits: after a save the query refetches and hands
    // back a NEW object, but `prevConfig` is non-null by then, so nothing is
    // reset.
    const configArrived = isOpen && !prevConfig && Boolean(config);
    setPrevOpen(isOpen);
    setPrevScope(selectedScope);
    setPrevConfig(config);
    setPrevRemoteBuyerMessaging(remoteBuyerMessaging);
    setPrevBuyerMessageTemplates(buyerMessageTemplates);

    if (isOpen && (didOpen || scopeChanged || configArrived)) {
      const next = resolveScopeConfig(storeConfigs, selectedScope);
      setStep(StoreSettingsDrawerStep.ADDRESS);
      setCountry(next?.country ?? '');
      setStateField(next?.state ?? '');
      setZipCode(next?.zipCode ?? '');
      setCity(next?.shipFromCity ?? '');
      setCheckBlacklist(next?.checkBlacklist ?? true);
      setAmazonTaxRate(next?.amazonTaxRate ?? 0);
      setAutoFulfillEnabled(next?.autoFulfillEnabled ?? false);
      setTrackingConversionEnabled(
        (next?.trackingConversionProvider ?? TrackingConversionProvider.LOCAL) !==
          TrackingConversionProvider.LOCAL
      );
      setTrackingConversionScope(
        next?.trackingConversionScope ?? TrackingConversionScope.AMAZON_LOGISTICS_ONLY
      );
      setTrackingConvertManualOrders(next?.trackingConvertManualOrders ?? true);
      // A confirmation left open across a scope switch would apply to the row
      // the seller is no longer looking at.
      setIsConfirmingConversionOff(false);
      setIsConfirmingManualOff(false);
      setAddressSubmitAttempted(false);
      setBuyerMessagingConfig(remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
    } else if (isOpen && step === StoreSettingsDrawerStep.ADDRESS) {
      setBuyerMessagingConfig(remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
    }
  }

  const isGlobal = selectedScope === GLOBAL_SCOPE;

  const save = (): void => {
    void Promise.all([
      saveSettings({
        isGlobal,
        storeId,
        country: country.trim(),
        state: stateField.trim(),
        zipCode: zipCode.trim(),
        // Persists to `store_settings.ship_from_city` (migration 089). That
        // column was minted for a separate tracking-provider address that no
        // longer exists as its own form — it is now simply the location city,
        // read by both the eBay inventory location and the provider profile.
        shipFromCity: city.trim(),
        checkBlacklist,
        amazonTaxRate,
        autoFulfillEnabled,
        // Conversion no longer depends on the address at all: the provider
        // requires only `accountOrigin` to create a profile (verified live,
        // 2026-09-02) and we send it no `storeAddress`. The address is still
        // required by the step, but for eBay's inventory location.
        trackingConversionProvider: trackingConversionEnabled
          ? TrackingConversionProvider.AQUILINE
          : TrackingConversionProvider.LOCAL,
        trackingConversionScope,
        trackingConvertManualOrders,
      }).unwrap(),
      updateBuyerMessaging({ config: buyerMessagingConfig, storeId }).unwrap(),
    ])
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
      })
      .catch((error: Parameters<typeof getErrorI18nKey>[0]) => {
        showMessage({ type: 'error', headerKey: 'translation:message.error.header', descriptionKey: getErrorI18nKey(error), primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage } }, t);
      });
  };

  // All four are required by eBay, which refuses a STORE inventory location
  // without the full set (addressLine1 + city + stateOrProvince + postalCode +
  // country). There is no street field — see `buildStoreStreetLine` on the API
  // side for how one is derived — so these four ARE the address.
  //
  // The tracking provider is NOT a reason: it requires only `accountOrigin` to
  // create a profile (verified against the live API, 2026-09-02) and we send
  // it no address at all.
  const isAddressComplete = Boolean(
    country.trim() && stateField.trim() && city.trim() && zipCode.trim()
  );

  const handleContinue = (): void => {
    if (step === StoreSettingsDrawerStep.ADDRESS && !isAddressComplete) {
      // Surface the validation instead of leaving Continue silently disabled —
      // this is the attempt that turns the empty fields red.
      setAddressSubmitAttempted(true);
      return;
    }
    if (step === StoreSettingsDrawerStep.BLACKLIST) {
      save();
    } else {
      setStep((step + 1) as StoreSettingsDrawerStep);
    }
  };

  const addressFieldErrors = {
    country: addressSubmitAttempted && !country.trim(),
    state: addressSubmitAttempted && !stateField.trim(),
    city: addressSubmitAttempted && !city.trim(),
    zipCode: addressSubmitAttempted && !zipCode.trim(),
  };

  // Switching either guard ON is free and applies immediately; switching it
  // OFF is the destructive direction, so it only asks — the state is written
  // by the modal's confirm handler, which is what keeps the Toggle visually ON
  // while the seller decides.
  const handleTrackingConversionEnabledChange = (enabled: boolean): void => {
    if (!enabled) {
      setIsConfirmingConversionOff(true);
      return;
    }
    setTrackingConversionEnabled(true);
  };

  const handleTrackingConvertManualOrdersChange = (checked: boolean): void => {
    if (!checked) {
      setIsConfirmingManualOff(true);
      return;
    }
    setTrackingConvertManualOrders(true);
  };

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
        { label: t('translation:settingsHub.drawer.storeSettings.steps.address') },
        { label: t('translation:settingsHub.drawer.storeSettings.steps.automation') },
        { label: t('translation:settingsHub.drawer.storeSettings.steps.messaging') },
        { label: t('translation:settingsHub.drawer.storeSettings.steps.blacklist') },
      ]}
      onBack={() => setStep((step - 1) as StoreSettingsDrawerStep)}
      onContinue={handleContinue}
      isSaving={isSaving}
      isContinueDisabled={isSaving}
      scopeOptions={buildScopeOptions(availableStores, t('translation:settingsHub.drawer.storeSettings.global'))}
      selectedScope={selectedScope}
      onSelectScope={onSelectScope}
      country={country}
      state={stateField}
      city={city}
      zipCode={zipCode}
      isAddressComplete={isAddressComplete}
      addressFieldErrors={addressFieldErrors}
      checkBlacklist={checkBlacklist}
      amazonTaxRate={amazonTaxRate}
      autoFulfillEnabled={autoFulfillEnabled}
      trackingConversionEnabled={trackingConversionEnabled}
      onTrackingConversionEnabledChange={handleTrackingConversionEnabledChange}
      trackingConversionScope={trackingConversionScope}
      onTrackingConversionScopeChange={setTrackingConversionScope}
      trackingConvertManualOrders={trackingConvertManualOrders}
      onTrackingConvertManualOrdersChange={handleTrackingConvertManualOrdersChange}
      showConversionOffWarning={!trackingConversionEnabled}
      showManualExposureWarning={trackingConversionEnabled && !trackingConvertManualOrders}
      isEveryOrderManual={!autoFulfillEnabled}
      isConfirmingConversionOff={isConfirmingConversionOff}
      onConfirmConversionOff={() => {
        setTrackingConversionEnabled(false);
        setIsConfirmingConversionOff(false);
      }}
      onCancelConversionOff={() => setIsConfirmingConversionOff(false)}
      isConfirmingManualOff={isConfirmingManualOff}
      onConfirmManualOff={() => {
        setTrackingConvertManualOrders(false);
        setIsConfirmingManualOff(false);
      }}
      onCancelManualOff={() => setIsConfirmingManualOff(false)}
      buyerMessagingConfig={buyerMessagingConfig}
      buyerMessageTemplates={buyerMessageTemplates}
      onToggleBuyerMessagingMaster={(enabled) => setBuyerMessagingConfig((current) => ({ ...current, enabled }))}
      onToggleBuyerMessagingEvent={(event, enabled) => updateEvent(event, (current) => ({ ...current, enabled }))}
      onPickBuyerMessageTemplate={(event, templateId) => updateEvent(event, (current) => ({ ...current, template: { kind: BuyerMessageTemplateKind.CUSTOM, id: templateId } }))}
      onChangeBuyerMessageDelayDays={(event, delayDays) => updateEvent(event, (current) => ({ ...current, delayDays }))}
      onCountryChange={(e) => setCountry(e.target.value)}
      onStateChange={(e) => setStateField(e.target.value)}
      onCityChange={(e) => setCity(e.target.value)}
      onZipCodeChange={(e) => setZipCode(e.target.value)}
      onToggleCheckBlacklist={setCheckBlacklist}
      onAmazonTaxRateChange={(e) => setAmazonTaxRate(Number(e.target.value) || 0)}
      onAutoFulfillEnabledChange={setAutoFulfillEnabled}
    />
  );
};

StoreSettingsDrawer.displayName = 'StoreSettingsDrawer';
