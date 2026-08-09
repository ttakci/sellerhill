import { StoreSettingsDrawerStep } from '@repo/shared';
import { Button, Drawer, InfoMessage, ModernSelect, ModernTextInput, Stepper, Text, Textarea, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BuyerMessagingSection } from './BuyerMessagingSection/BuyerMessagingSection.container';
import { BodyStack, FieldGrid, FormCard, ToggleRow } from './StoreSettingsDrawer.style';
import type { BlacklistScope, StoreSettingsDrawerComponentProps } from './StoreSettingsDrawer.types';

import { BlacklistCard } from '@/features/store-settings/components/BlacklistCard';

export const StoreSettingsDrawerComponent: React.FC<StoreSettingsDrawerComponentProps> = (props) => {
  const { t } = useTranslation(['translation', 'storeSettings']);
  const isFirst = props.step === StoreSettingsDrawerStep.GENERAL;
  const isLast = props.step === StoreSettingsDrawerStep.BLACKLIST;
  return <Drawer isOpen={props.isOpen} onClose={props.onClose} onBack={isFirst ? undefined : props.onBack} backAriaLabel={t('translation:common.back')} title={t('translation:settingsHub.drawer.storeSettings.title')} subtitle={t('translation:settingsHub.drawer.storeSettings.subtitle')} size="md" primaryAction={{ label: t(isLast ? 'translation:common.save' : 'translation:common.continue'), onClick: props.onContinue, isLoading: props.isSaving, disabled: props.isContinueDisabled }}>
    <BodyStack><Stepper steps={props.steps} currentStep={props.step} />
      {isFirst && <FormCard>
        <ModernSelect label={t('translation:settingsHub.drawer.storeSettings.appliesTo')} options={props.scopeOptions} value={props.selectedScope} onChange={(value) => props.onSelectScope(String(value))} fullWidth searchPlaceholder={t('translation:common.search')} noResultsMessage={t('translation:common.noResults')} />
        <ModernTextInput name="country" label={t('translation:settingsHub.drawer.storeSettings.country')} value={props.country} onChange={props.onCountryChange} />
        <FieldGrid><ModernTextInput name="region" label={t('translation:settingsHub.drawer.storeSettings.region')} value={props.state} onChange={props.onStateChange} /><ModernTextInput name="zipCode" label={t('translation:settingsHub.drawer.storeSettings.zipCode')} value={props.zipCode} onChange={props.onZipCodeChange} /></FieldGrid>
        <ToggleRow><Text variant="body-sm">{t('storeSettings:storeSettings.autoFulfillEnabled')}</Text><Toggle checked={props.autoFulfillEnabled} onChange={props.onAutoFulfillEnabledChange} /></ToggleRow>
        <ModernTextInput name="amazonTaxRate" type="number" label={t('storeSettings:storeSettings.amazonTaxRate')} value={String(props.amazonTaxRate)} onChange={props.onAmazonTaxRateChange} isDisabled={!props.autoFulfillEnabled} />
        <InfoMessage>{t('storeSettings:storeSettings.amazonTaxRateDesc')}</InfoMessage>
      </FormCard>}
      {props.step === StoreSettingsDrawerStep.BUYER_MESSAGING && <BuyerMessagingSection config={props.buyerMessagingConfig} templates={props.buyerMessageTemplates} onToggleMaster={props.onToggleBuyerMessagingMaster} onToggleEvent={props.onToggleBuyerMessagingEvent} onPickTemplate={props.onPickBuyerMessageTemplate} onChangeDelayDays={props.onChangeBuyerMessageDelayDays} />}
      {isLast && <><FormCard><Text variant="body-sm" weight="semibold">{t('translation:settingsHub.drawer.storeSettings.validation')}</Text><ToggleRow><Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.validateTitle')}</Text><Toggle checked={props.validateTitle} onChange={props.onToggleValidateTitle} /></ToggleRow><ToggleRow><Text variant="body-sm">{t('translation:settingsHub.drawer.storeSettings.validateDescription')}</Text><Toggle checked={props.validateDescription} onChange={props.onToggleValidateDescription} /></ToggleRow></FormCard><FormCard><ModernSelect label={t('translation:settingsHub.drawer.blacklist.add.scope')} options={[{ value: 'both', label: t('translation:settingsHub.drawer.blacklist.add.scopeBoth') }, { value: 'title', label: t('translation:settingsHub.drawer.blacklist.add.scopeTitle') }, { value: 'description', label: t('translation:settingsHub.drawer.blacklist.add.scopeDescription') }]} value={props.blacklistScope} onChange={(value) => props.onBlacklistScopeChange(value as BlacklistScope)} fullWidth /><Textarea value={props.keywords} onChange={props.onKeywordsChange} placeholder={t('translation:settingsHub.drawer.blacklist.add.keywordsPlaceholder')} fullWidth rows={4} aria-label={t('translation:settingsHub.drawer.blacklist.add.keywordsLabel')} /><Text variant="caption" color="text.tertiary">{t('translation:settingsHub.drawer.blacklist.add.keywordsHint')}</Text><Button variant="secondary" onClick={props.onAddKeyword}><Text weight="semibold">{t('translation:settingsHub.drawer.blacklist.add.add')}</Text></Button>{props.blacklistError && <Text variant="caption" color="semantic.error">{props.blacklistError}</Text>}</FormCard>{props.blacklist.length ? props.blacklist.map((item) => <BlacklistCard key={`${item.keyword}-${item.scope}`} keyword={item.keyword} scope={item.scope} onRemove={() => props.onRemoveKeyword(item)} />) : <Text variant="body-sm" color="text.secondary">{t('translation:settingsHub.drawer.blacklist.list.empty')}</Text>}</>}
    </BodyStack>
  </Drawer>;
};
StoreSettingsDrawerComponent.displayName = 'StoreSettingsDrawerComponent';
