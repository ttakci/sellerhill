import { StoreSettingsDrawerStep, TrackingConversionScope } from '@repo/shared';
import { Drawer, InfoMessage, ModernSelect, ModernTextInput, Stepper, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BuyerMessagingSection } from './BuyerMessagingSection/BuyerMessagingSection.container';
import { BodyStack, FieldGrid, FormCard, ShipFromSection, ToggleRow } from './StoreSettingsDrawer.style';
import type { StoreSettingsDrawerComponentProps } from './StoreSettingsDrawer.types';

export const StoreSettingsDrawerComponent: React.FC<StoreSettingsDrawerComponentProps> = (props) => {
  const { t } = useTranslation(['translation', 'storeSettings']);
  const isFirst = props.step === StoreSettingsDrawerStep.GENERAL;
  const isMessaging = props.step === StoreSettingsDrawerStep.BUYER_MESSAGING;
  const isLast = props.step === StoreSettingsDrawerStep.BLACKLIST;

  return (
    <Drawer
      isOpen={props.isOpen}
      onClose={props.onClose}
      onBack={isFirst ? undefined : props.onBack}
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
        {isFirst && (
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
            <ModernTextInput
              name="country"
              label={t('translation:settingsHub.drawer.storeSettings.country')}
              value={props.country}
              onChange={props.onCountryChange}
            />
            <FieldGrid>
              <ModernTextInput
                name="region"
                label={t('translation:settingsHub.drawer.storeSettings.region')}
                value={props.state}
                onChange={props.onStateChange}
              />
              <ModernTextInput
                name="zipCode"
                label={t('translation:settingsHub.drawer.storeSettings.zipCode')}
                value={props.zipCode}
                onChange={props.onZipCodeChange}
              />
            </FieldGrid>
            <ShipFromSection>
              <Text variant="h5">{t('storeSettings:storeSettings.shipFrom.title')}</Text>
              <InfoMessage>{t('storeSettings:storeSettings.shipFrom.description')}</InfoMessage>
              {props.isGlobalScope ? (
                <>
                  <FieldGrid>
                    <ModernTextInput
                      name="shipFromName"
                      label={t('storeSettings:storeSettings.shipFrom.name')}
                      value={props.shipFromName}
                      onChange={props.onShipFromNameChange}
                    />
                    <ModernTextInput
                      name="shipFromPhone"
                      type="tel"
                      label={t('storeSettings:storeSettings.shipFrom.phone')}
                      value={props.shipFromPhone}
                      onChange={props.onShipFromPhoneChange}
                    />
                  </FieldGrid>
                  <ModernTextInput
                    name="shipFromAddressLine1"
                    label={t('storeSettings:storeSettings.shipFrom.addressLine1')}
                    value={props.shipFromAddressLine1}
                    onChange={props.onShipFromAddressLine1Change}
                  />
                  <ModernTextInput
                    name="shipFromAddressLine2"
                    label={t('storeSettings:storeSettings.shipFrom.addressLine2')}
                    value={props.shipFromAddressLine2}
                    onChange={props.onShipFromAddressLine2Change}
                  />
                  <ModernTextInput
                    name="shipFromCity"
                    label={t('storeSettings:storeSettings.shipFrom.city')}
                    value={props.shipFromCity}
                    onChange={props.onShipFromCityChange}
                  />
                  {!props.isShipFromAddressComplete && (
                    <InfoMessage>
                      {t('storeSettings:storeSettings.shipFrom.incompleteHint')}
                    </InfoMessage>
                  )}
                </>
              ) : (
                <InfoMessage>{t('storeSettings:storeSettings.shipFrom.globalOnly')}</InfoMessage>
              )}
            </ShipFromSection>
            <ToggleRow>
              <Text variant="body-sm">{t('storeSettings:storeSettings.autoFulfillEnabled')}</Text>
              <Toggle checked={props.autoFulfillEnabled} onChange={props.onAutoFulfillEnabledChange} />
            </ToggleRow>
            <ModernTextInput
              name="amazonTaxRate"
              type="number"
              label={t('storeSettings:storeSettings.amazonTaxRate')}
              value={String(props.amazonTaxRate)}
              onChange={props.onAmazonTaxRateChange}
              isDisabled={!props.autoFulfillEnabled}
            />
            <InfoMessage>{t('storeSettings:storeSettings.amazonTaxRateDesc')}</InfoMessage>
            <ModernSelect
              name="trackingConversionScope"
              label={t('storeSettings:storeSettings.trackingConversionScope')}
              value={props.trackingConversionScope}
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
            <InfoMessage>{t('storeSettings:storeSettings.trackingConversionScopeHint')}</InfoMessage>
            <ToggleRow>
              <Text variant="body-sm">
                {t('storeSettings:storeSettings.trackingConvertManualOrders')}
              </Text>
              <Toggle
                checked={props.trackingConvertManualOrders}
                onChange={props.onTrackingConvertManualOrdersChange}
              />
            </ToggleRow>
            <InfoMessage>
              {t('storeSettings:storeSettings.trackingConvertManualOrdersHint')}
            </InfoMessage>
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
    </Drawer>
  );
};

StoreSettingsDrawerComponent.displayName = 'StoreSettingsDrawerComponent';
