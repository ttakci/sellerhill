import { StoreSettingsDrawerStep, TrackingConversionScope } from '@repo/shared';
import { ConfirmModal, Drawer, Icon, InfoMessage, ModernSelect, ModernTextInput, Stepper, Text, Toggle, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BuyerMessagingSection } from './BuyerMessagingSection/BuyerMessagingSection.container';
import { AutomationField, BodyStack, FieldGroup, FormCard, InfoButton, LabelWithInfo, ToggleRow } from './StoreSettingsDrawer.style';
import type { StoreSettingsDrawerComponentProps } from './StoreSettingsDrawer.types';

/** Label text plus an "i" that reveals the field's explanation on hover/focus —
 *  the automation step's replacement for a stack of always-on `InfoMessage`
 *  blocks. Mirrors the trigger in `BuyerMessagingSection`. */
const InfoTip: React.FC<{ text: string }> = ({ text }) => (
  <Tooltip content={text} position="top" variant="dark">
    <InfoButton type="button" variant="ghost" aria-label={text}>
      <Icon name="info" size={14} color="text.tertiary" />
    </InfoButton>
  </Tooltip>
);

export const StoreSettingsDrawerComponent: React.FC<StoreSettingsDrawerComponentProps> = (props) => {
  const { t } = useTranslation(['translation', 'storeSettings']);
  const isAddress = props.step === StoreSettingsDrawerStep.ADDRESS;
  const isAutomation = props.step === StoreSettingsDrawerStep.AUTOMATION;
  const isMessaging = props.step === StoreSettingsDrawerStep.BUYER_MESSAGING;
  const isLast = props.step === StoreSettingsDrawerStep.BLACKLIST;

  return (
    <Drawer
      isOpen={props.isOpen}
      onClose={props.onClose}
      onBack={isAddress ? undefined : props.onBack}
      backAriaLabel={t('translation:common.back')}
      title={t('translation:settingsHub.drawer.storeSettings.title')}
      subtitle={t('translation:settingsHub.drawer.storeSettings.subtitle')}
      size="md"
      primaryAction={{
        label: t(isLast ? 'translation:common.save' : 'translation:common.continue'),
        onClick: props.onContinue,
        isLoading: props.isSaving,
        disabled: props.isContinueDisabled,
      }}
    >
      <BodyStack>
        <Stepper steps={props.steps} currentStep={props.step} />
        {isAddress && (
          <FormCard>
            <ModernSelect
              label={t('translation:settingsHub.drawer.storeSettings.appliesTo')}
              options={props.scopeOptions}
              value={props.selectedScope}
              onChange={(value) => props.onSelectScope(String(value))}
              fullWidth
              searchPlaceholder={t('translation:common.search')}
              noResultsMessage={t('translation:common.noResults')}
            />
            <FieldGroup>
              <Text variant="h5">{t('storeSettings:storeSettings.address.title')}</Text>
              <ModernTextInput
                name="country"
                label={t('translation:settingsHub.drawer.storeSettings.country')}
                value={props.country}
                onChange={props.onCountryChange}
                errorMessage={props.addressFieldErrors.country ? t('translation:validation.required') : undefined}
              />
              <ModernTextInput
                name="region"
                label={t('translation:settingsHub.drawer.storeSettings.region')}
                value={props.state}
                onChange={props.onStateChange}
                errorMessage={props.addressFieldErrors.state ? t('translation:validation.required') : undefined}
              />
              <ModernTextInput
                name="city"
                label={t('storeSettings:storeSettings.address.city')}
                value={props.city}
                onChange={props.onCityChange}
                errorMessage={props.addressFieldErrors.city ? t('translation:validation.required') : undefined}
              />
              <ModernTextInput
                name="zipCode"
                label={t('translation:settingsHub.drawer.storeSettings.zipCode')}
                value={props.zipCode}
                onChange={props.onZipCodeChange}
                errorMessage={props.addressFieldErrors.zipCode ? t('translation:validation.required') : undefined}
              />
              <InfoMessage>{t('storeSettings:storeSettings.address.description')}</InfoMessage>
            </FieldGroup>
          </FormCard>
        )}
        {isAutomation && (
          <FormCard>
            <ToggleRow>
              <LabelWithInfo>
                <Text variant="body-sm">{t('storeSettings:storeSettings.autoFulfillEnabled')}</Text>
                <InfoTip text={t('storeSettings:storeSettings.autoFulfillEnabledHint')} />
              </LabelWithInfo>
              <Toggle checked={props.autoFulfillEnabled} onChange={props.onAutoFulfillEnabledChange} />
            </ToggleRow>
            <AutomationField>
              <LabelWithInfo>
                <Text variant="body-sm">{t('storeSettings:storeSettings.amazonTaxRate')}</Text>
                <InfoTip text={t('storeSettings:storeSettings.amazonTaxRateDesc')} />
              </LabelWithInfo>
              <ModernTextInput
                name="amazonTaxRate"
                type="number"
                value={String(props.amazonTaxRate)}
                onChange={props.onAmazonTaxRateChange}
                isDisabled={!props.autoFulfillEnabled}
                suffixText="%"
              />
            </AutomationField>
            <ToggleRow>
              <LabelWithInfo>
                <Text variant="body-sm">
                  {t('storeSettings:storeSettings.trackingConversionEnabled')}
                </Text>
                <InfoTip text={t('storeSettings:storeSettings.trackingConversionEnabledHint')} />
              </LabelWithInfo>
              <Toggle
                checked={props.trackingConversionEnabled}
                onChange={props.onTrackingConversionEnabledChange}
              />
            </ToggleRow>
            {props.showConversionOffWarning && (
              <InfoMessage type="error">
                {t('storeSettings:storeSettings.trackingExposure.conversionOff')}
              </InfoMessage>
            )}
            <AutomationField>
              <LabelWithInfo>
                <Text variant="body-sm">
                  {t('storeSettings:storeSettings.trackingConversionScope')}
                </Text>
                <InfoTip text={t('storeSettings:storeSettings.trackingConversionScopeHint')} />
              </LabelWithInfo>
              <ModernSelect
                name="trackingConversionScope"
                value={props.trackingConversionScope}
                isDisabled={!props.trackingConversionEnabled}
                fullWidth
                options={[
                  {
                    value: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
                    label: t('storeSettings:storeSettings.trackingConversionScopeAmazonOnly'),
                  },
                  {
                    value: TrackingConversionScope.ALL,
                    label: t('storeSettings:storeSettings.trackingConversionScopeAll'),
                  },
                ]}
                onChange={(value) => props.onTrackingConversionScopeChange(value as TrackingConversionScope)}
              />
            </AutomationField>
            <ToggleRow>
              <LabelWithInfo>
                <Text variant="body-sm">
                  {t('storeSettings:storeSettings.trackingConvertManualOrders')}
                </Text>
                <InfoTip text={t('storeSettings:storeSettings.trackingConvertManualOrdersHint')} />
              </LabelWithInfo>
              <Toggle
                checked={props.trackingConvertManualOrders}
                onChange={props.onTrackingConvertManualOrdersChange}
                disabled={!props.trackingConversionEnabled}
              />
            </ToggleRow>
            {props.showManualExposureWarning && (
              <InfoMessage type="error">
                {t(
                  props.isEveryOrderManual
                    ? 'storeSettings:storeSettings.trackingExposure.manualAll'
                    : 'storeSettings:storeSettings.trackingExposure.manualSome'
                )}
              </InfoMessage>
            )}
          </FormCard>
        )}
        {isMessaging && (
          <BuyerMessagingSection
            config={props.buyerMessagingConfig}
            templates={props.buyerMessageTemplates}
            onToggleMaster={props.onToggleBuyerMessagingMaster}
            onToggleEvent={props.onToggleBuyerMessagingEvent}
            onPickTemplate={props.onPickBuyerMessageTemplate}
            onChangeDelayDays={props.onChangeBuyerMessageDelayDays}
          />
        )}
        {isLast && (
          <FormCard>
            <ToggleRow>
              <Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.checkBlacklist')}</Text>
              <Toggle checked={props.checkBlacklist} onChange={props.onToggleCheckBlacklist} />
            </ToggleRow>
            <InfoMessage>{t('translation:settingsHub.drawer.storeSettings.checkBlacklistDesc')}</InfoMessage>
          </FormCard>
        )}
      </BodyStack>

      {/* Both confirmations are `type="error"`, not "warning": the consequence
          is a raw Amazon number on a live eBay order, and eBay has no endpoint
          to revise a fulfillment once it is sent. */}
      <ConfirmModal
        isOpen={props.isConfirmingConversionOff}
        onClose={props.onCancelConversionOff}
        onConfirm={props.onConfirmConversionOff}
        type="error"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={t('storeSettings:storeSettings.trackingExposure.confirmConversionOff')}
        confirmLabel={t('storeSettings:storeSettings.trackingExposure.confirmDisable')}
        cancelLabel={t('translation:common.cancel')}
      />
      <ConfirmModal
        isOpen={props.isConfirmingManualOff}
        onClose={props.onCancelManualOff}
        onConfirm={props.onConfirmManualOff}
        type="error"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={t('storeSettings:storeSettings.trackingExposure.confirmManualOff')}
        confirmLabel={t('storeSettings:storeSettings.trackingExposure.confirmDisable')}
        cancelLabel={t('translation:common.cancel')}
      />
    </Drawer>
  );
};

StoreSettingsDrawerComponent.displayName = 'StoreSettingsDrawerComponent';
