import { AmazonAccountDrawerStep, ProxyConnectionType } from '@repo/shared';
import { Drawer, Icon, InfoMessage, ModernSelect, ModernTextInput, Stepper, Text, Toggle, Tooltip } from '@repo/ui';
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
  fields,
  isSaving,
  step,
  steps,
  accountFieldErrors,
  onNext,
  onStepBack,
  onFieldChange,
  onTwoFactorSecretFocus,
  onAutoFulfillEnabledChange,
  onProxyEnabledChange,
  onProxyConnectionTypeChange,
  onSave,
}) => {
  const { t } = useTranslation(['amazon', 'translation']);

  const isProxyStep = step === AmazonAccountDrawerStep.PROXY;
  const requiredError = t('translation:validation.required');

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t(`${prefix}.title`)}
      subtitle={isProxyStep ? t('amazon:amazon.proxy.stepSubtitle') : t(`${prefix}.subtitle`)}
      onBack={isProxyStep ? onStepBack : onBack}
      backAriaLabel={t('translation:common.back')}
      size="md"
      primaryAction={
        isProxyStep
          ? { label: t('translation:common.save'), onClick: onSave, isLoading: isSaving }
          : { label: t('translation:common.next'), onClick: onNext }
      }
    >
      <S.BodyStack>
        <Stepper steps={steps} currentStep={step} />
        {isProxyStep ? (
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
        ) : (
          <S.FormCard>
            <InfoMessage>{t('amazon:amazon.marketplace.usOnlyNote')}</InfoMessage>
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
              errorMessage={accountFieldErrors.email ? requiredError : undefined}
            />
            <ModernTextInput
              name="password"
              label={t('translation:settingsHub.drawer.amazonAdd.password')}
              value={fields.password}
              type="password"
              onChange={onFieldChange('password')}
              errorMessage={accountFieldErrors.password ? requiredError : undefined}
            />
            <ModernTextInput
              name="twoFactorSecret"
              label={t('translation:settingsHub.drawer.amazonAdd.twoFactorSecret')}
              value={fields.twoFactorSecret}
              onChange={onFieldChange('twoFactorSecret')}
              onFocus={onTwoFactorSecretFocus}
              errorMessage={accountFieldErrors.twoFactorSecret ? requiredError : undefined}
            />
            <InfoMessage>{t('translation:settingsHub.drawer.amazonAdd.twoFactorSecretHint')}</InfoMessage>
            <S.ToggleRow>
              <S.ToggleTitleRow>
                <Text variant="body-sm">{t('amazon:amazon.autoFulfill.autoFulfillEnabled')}</Text>
                <Tooltip content={t('amazon:amazon.autoFulfill.autoFulfillEnabledHint')} position="top" variant="dark">
                  <S.InfoButton
                    type="button"
                    variant="ghost"
                    aria-label={t('amazon:amazon.autoFulfill.autoFulfillEnabledHint')}
                  >
                    <Icon name="info" size={14} color="text.tertiary" />
                  </S.InfoButton>
                </Tooltip>
              </S.ToggleTitleRow>
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
              errorMessage={accountFieldErrors.autoFulfillCapTotal ? requiredError : undefined}
            />
            <InfoMessage>{t('amazon:amazon.autoFulfill.autoFulfillCapTotalHint')}</InfoMessage>
          </S.FormCard>
        )}
      </S.BodyStack>
    </Drawer>
  );
};

AmazonAccountDrawerComponent.displayName = 'AmazonAccountDrawerComponent';
