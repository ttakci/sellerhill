import { Drawer, InfoMessage, ModernTextInput, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountDrawer.style';
import type { AmazonAccountDrawerComponentProps } from './AmazonAccountDrawer.types';

export const AmazonAccountDrawerComponent: React.FC<AmazonAccountDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  prefix,
  fields,
  isSaving,
  onFieldChange,
  onAutoFulfillEnabledChange,
  onSave,
}) => {
  const { t } = useTranslation();

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
      </S.BodyStack>
    </Drawer>
  );
};

AmazonAccountDrawerComponent.displayName = 'AmazonAccountDrawerComponent';
