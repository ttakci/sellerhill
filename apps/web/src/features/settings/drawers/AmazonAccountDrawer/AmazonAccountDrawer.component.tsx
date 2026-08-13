import { AmazonMarketplace, ProxyConnectionType, SUPPORTED_AMAZON_MARKETPLACES } from '@repo/shared';
import { Drawer, InfoMessage, ModernSelect, ModernTextInput, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountDrawer.style';
import type { AmazonAccountDrawerComponentProps } from './AmazonAccountDrawer.types';

const PROXY_CONNECTION_TYPE_OPTIONS = Object.values(ProxyConnectionType).map((value) => ({
  label: value,
  value,
}));

export const AmazonAccountDrawerComponent: React.FC<AmazonAccountDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  prefix,
  isEdit,
  fields,
  isSaving,
  onFieldChange,
  onAutoFulfillEnabledChange,
  onProxyEnabledChange,
  onProxyConnectionTypeChange,
  onMarketplaceChange,
  onSave,
}) => {
  const { t } = useTranslation(['amazon', 'translation']);

  // Only one option is live today (SUPPORTED_AMAZON_MARKETPLACES), but the
  // control always renders so a second Amazon marketplace can be enabled
  // later without a UI rebuild — same pattern as the eBay connect picker.
  const marketplaceOptions = SUPPORTED_AMAZON_MARKETPLACES.map((marketplace) => ({
    label: t(`amazon:amazon.marketplace.${marketplace}`),
    value: marketplace,
  }));

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t(`${prefix}.title`)}
      subtitle={t(`${prefix}.subtitle`)}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      size="md"
      primaryAction={{
        label: t('translation:common.save'),
        onClick: onSave,
        isLoading: isSaving,
      }}
    >
      <S.BodyStack>
        <S.FormCard>
          <ModernSelect
            label={t('amazon:amazon.marketplace.label')}
            options={marketplaceOptions}
            value={fields.marketplace}
            onChange={(value) => onMarketplaceChange(value as AmazonMarketplace)}
            isDisabled={isEdit || marketplaceOptions.length <= 1}
            fullWidth
          />
          {isEdit && <InfoMessage>{t('amazon:amazon.marketplace.readOnlyHint')}</InfoMessage>}
          <ModernTextInput
            name="label"
            label={t('translation:settingsHub.drawer.amazonAdd.label')}
            value={fields.label}
            onChange={onFieldChange('label')}
          />
          <ModernTextInput
            name="email"
            label={t('translation:settingsHub.drawer.amazonAdd.email')}
            value={fields.email}
            type="email"
            onChange={onFieldChange('email')}
          />
          <ModernTextInput
            name="password"
            label={t('translation:settingsHub.drawer.amazonAdd.password')}
            value={fields.password}
            type="password"
            onChange={onFieldChange('password')}
          />
          <ModernTextInput
            name="twoFactorSecret"
            label={t('translation:settingsHub.drawer.amazonAdd.twoFactorSecret')}
            value={fields.twoFactorSecret}
            onChange={onFieldChange('twoFactorSecret')}
          />
          <S.ToggleRow>
            <Text variant="body-sm">{t('amazon:amazon.autoFulfill.autoFulfillEnabled')}</Text>
            <Toggle checked={fields.autoFulfillEnabled} onChange={onAutoFulfillEnabledChange} />
          </S.ToggleRow>
          <ModernTextInput
            name="autoFulfillCapTotal"
            type="number"
            label={t('amazon:amazon.autoFulfill.autoFulfillCapTotal')}
            placeholder={t('amazon:amazon.autoFulfill.autoFulfillCapTotalPlaceholder')}
            value={fields.autoFulfillCapTotal}
            onChange={onFieldChange('autoFulfillCapTotal')}
            isDisabled={!fields.autoFulfillEnabled}
          />
          <InfoMessage>{t('amazon:amazon.autoFulfill.autoFulfillCapTotalHint')}</InfoMessage>
        </S.FormCard>

        <S.FormCard>
          <Text variant="h5" weight="semibold">
            {t('amazon:amazon.proxy.sectionTitle')}
          </Text>
          <S.ToggleRow>
            <Text variant="body-sm">{t('amazon:amazon.proxy.enabledHint')}</Text>
            <Toggle checked={fields.proxyEnabled} onChange={onProxyEnabledChange} />
          </S.ToggleRow>
          <ModernSelect
            label={t('amazon:amazon.proxy.connectionType')}
            options={PROXY_CONNECTION_TYPE_OPTIONS}
            value={fields.proxyConnectionType}
            onChange={(value) => onProxyConnectionTypeChange(value as ProxyConnectionType)}
            isDisabled={!fields.proxyEnabled}
            fullWidth
          />
          <ModernTextInput
            name="proxyHost"
            label={t('amazon:amazon.proxy.host')}
            value={fields.proxyHost}
            onChange={onFieldChange('proxyHost')}
            isDisabled={!fields.proxyEnabled}
          />
          <ModernTextInput
            name="proxyPort"
            type="number"
            label={t('amazon:amazon.proxy.port')}
            value={fields.proxyPort}
            onChange={onFieldChange('proxyPort')}
            isDisabled={!fields.proxyEnabled}
          />
          <ModernTextInput
            name="proxyUsername"
            label={t('amazon:amazon.proxy.username')}
            value={fields.proxyUsername}
            onChange={onFieldChange('proxyUsername')}
            isDisabled={!fields.proxyEnabled}
          />
          <ModernTextInput
            name="proxyPassword"
            type="password"
            label={t('amazon:amazon.proxy.password')}
            value={fields.proxyPassword}
            onChange={onFieldChange('proxyPassword')}
            isDisabled={!fields.proxyEnabled}
          />
          <InfoMessage>{t('amazon:amazon.proxy.hint')}</InfoMessage>
        </S.FormCard>
      </S.BodyStack>
    </Drawer>
  );
};

AmazonAccountDrawerComponent.displayName = 'AmazonAccountDrawerComponent';
