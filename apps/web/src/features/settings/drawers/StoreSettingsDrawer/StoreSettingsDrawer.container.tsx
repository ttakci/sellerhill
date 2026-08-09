import { BuyerMessageEventConfig, BuyerMessageEventType, BuyerMessagingConfig, BuyerMessageTemplate, BuyerMessageTemplateKind, BuyerMessageTemplateRef, StoreSettingsDrawerStep, TrackingConversionProvider } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { buildScopeOptions, GLOBAL_SCOPE, resolveScopeConfig } from '../storeScope';

import { StoreSettingsDrawerComponent } from './StoreSettingsDrawer.component';
import type { BlacklistItem, BlacklistScope, StoreSettingsDrawerProps } from './StoreSettingsDrawer.types';

import { useGetBuyerMessageTemplatesQuery } from '@/features/buyer-messaging/api/buyer-messaging.api';
import { useGetBuyerMessagingConfigQuery, useSaveStoreSettingsMutation, useUpdateBuyerMessagingConfigMutation } from '@/features/store-settings/api/storeSettingsApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const toBlacklist = (entries: Array<{ keyword: string; scope: BlacklistScope }> | undefined): BlacklistItem[] =>
  (entries ?? []).map(({ keyword, scope }) => ({ keyword, scope }));

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
  const [validateTitle, setValidateTitle] = useState(config?.validateTitle ?? true);
  const [validateDescription, setValidateDescription] = useState(config?.validateDescription ?? false);
  const [amazonTaxRate, setAmazonTaxRate] = useState(config?.amazonTaxRate ?? 0);
  const [autoFulfillEnabled, setAutoFulfillEnabled] = useState(config?.autoFulfillEnabled ?? false);
  const [buyerMessagingConfig, setBuyerMessagingConfig] = useState<BuyerMessagingConfig>(() =>
    remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
  const [blacklist, setBlacklist] = useState<BlacklistItem[]>(toBlacklist(config?.blacklist));
  const [keywords, setKeywords] = useState('');
  const [blacklistScope, setBlacklistScope] = useState<BlacklistScope>('both');
  const [blacklistError, setBlacklistError] = useState<string | null>(null);

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
      setValidateTitle(next?.validateTitle ?? true);
      setValidateDescription(next?.validateDescription ?? false);
      setAmazonTaxRate(next?.amazonTaxRate ?? 0);
      setAutoFulfillEnabled(next?.autoFulfillEnabled ?? false);
      setBuyerMessagingConfig(remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
      setBlacklist(toBlacklist(next?.blacklist));
      setKeywords('');
      setBlacklistError(null);
    } else if (isOpen && step === StoreSettingsDrawerStep.GENERAL) {
      setBuyerMessagingConfig(remoteBuyerMessaging ?? buildDefaultBuyerMessagingConfig(buyerMessageTemplates));
    }
  }

  const handleAddKeyword = useCallback(() => {
    const additions = keywords.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
    if (!additions.length) {
      setBlacklistError(t('translation:settingsHub.drawer.blacklist.add.empty'));
      return;
    }
    const unique = additions.filter(
      (keyword) => !blacklist.some(
        (item) => item.scope === blacklistScope && item.keyword.toLowerCase() === keyword.toLowerCase(),
      ),
    );
    if (!unique.length) {
      setBlacklistError(t('translation:settingsHub.drawer.blacklist.add.duplicate'));
      return;
    }
    setBlacklist((current) => [...current, ...unique.map((keyword) => ({ keyword, scope: blacklistScope }))]);
    setKeywords('');
    setBlacklistError(null);
  }, [blacklist, blacklistScope, keywords, t]);

  const save = (): void => {
    const isGlobal = selectedScope === GLOBAL_SCOPE;
    void Promise.all([
      saveSettings({
        isGlobal,
        storeId,
        country: country.trim(),
        state: stateField.trim(),
        zipCode: zipCode.trim(),
        validateTitle,
        validateDescription,
        blacklist,
        amazonTaxRate,
        autoFulfillEnabled,
        trackingConversionProvider: config?.trackingConversionProvider ?? TrackingConversionProvider.LOCAL,
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
      validateTitle={validateTitle}
      validateDescription={validateDescription}
      amazonTaxRate={amazonTaxRate}
      autoFulfillEnabled={autoFulfillEnabled}
      buyerMessagingConfig={buyerMessagingConfig}
      buyerMessageTemplates={buyerMessageTemplates}
      onToggleBuyerMessagingMaster={(enabled) => setBuyerMessagingConfig((current) => ({ ...current, enabled }))}
      onToggleBuyerMessagingEvent={(event, enabled) => updateEvent(event, (current) => ({ ...current, enabled }))}
      onPickBuyerMessageTemplate={(event, templateId) => updateEvent(event, (current) => ({ ...current, template: { kind: BuyerMessageTemplateKind.CUSTOM, id: templateId } }))}
      onChangeBuyerMessageDelayDays={(event, delayDays) => updateEvent(event, (current) => ({ ...current, delayDays }))}
      onCountryChange={(e) => setCountry(e.target.value)}
      onStateChange={(e) => setStateField(e.target.value)}
      onZipCodeChange={(e) => setZipCode(e.target.value)}
      onToggleValidateTitle={setValidateTitle}
      onToggleValidateDescription={setValidateDescription}
      onAmazonTaxRateChange={(e) => setAmazonTaxRate(Number(e.target.value) || 0)}
      onAutoFulfillEnabledChange={setAutoFulfillEnabled}
      keywords={keywords}
      onKeywordsChange={(e) => setKeywords(e.target.value)}
      blacklistScope={blacklistScope}
      onBlacklistScopeChange={setBlacklistScope}
      onAddKeyword={handleAddKeyword}
      blacklistError={blacklistError}
      blacklist={blacklist}
      onRemoveKeyword={(item) => setBlacklist((current) => current.filter((candidate) => candidate.keyword !== item.keyword || candidate.scope !== item.scope))}
    />
  );
};

StoreSettingsDrawer.displayName = 'StoreSettingsDrawer';
