import { Badge, Drawer, ModernTextInput, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountDrawer.style';
import type { AmazonAccountDrawerComponentProps } from './AmazonAccountDrawer.types';

export const AmazonAccountDrawerComponent: React.FC<AmazonAccountDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  isEdit,
  prefix,
  hasTwoFactor,
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
            label={t(`${prefix}.label`)}
            value={fields.label}
            onChange={onFieldChange('label')}
          />
          <ModernTextInput
            name="email"
            label={t(`${prefix}.email`)}
            value={fields.email}
            type="email"
            onChange={onFieldChange('email')}
          />
          <ModernTextInput
            name="password"
            label={t(`${prefix}.password`)}
            value={fields.password}
            type="password"
            onChange={onFieldChange('password')}
          />
          {isEdit && (
            <Text variant="caption" color="text.tertiary">
              {t('translation:settingsHub.drawer.amazonEdit.passwordHint')}
            </Text>
          )}
          <ModernTextInput
            name="twoFactorSecret"
            label={t(`${prefix}.twoFactorSecret`)}
            value={fields.twoFactorSecret}
            onChange={onFieldChange('twoFactorSecret')}
          />
          {isEdit && (
            <Text variant="caption" color="text.tertiary">
              <Badge variant={hasTwoFactor ? 'success' : 'neutral'} size="sm">
                {t(
                  hasTwoFactor
                    ? 'translation:settingsHub.drawer.amazonEdit.twoFactorBadgeSet'
                    : 'translation:settingsHub.drawer.amazonEdit.twoFactorBadgeNotSet'
                )}
              </Badge>{' '}
              {t('translation:settingsHub.drawer.amazonEdit.twoFactorHint')}
            </Text>
          )}
        </S.FormCard>

        <S.FormCard>
          <Text variant="h5" weight="semibold">
            {t('amazon:amazon.autoFulfill.sectionTitle')}
          </Text>
          <Text variant="caption" color="text.secondary">
            {t('amazon:amazon.autoFulfill.sectionSubtitle')}
          </Text>
          <S.ToggleRow>
            <Text variant="body-sm">{t('amazon:amazon.autoFulfill.autoFulfillEnabled')}</Text>
            <Toggle checked={fields.autoFulfillEnabled} onChange={onAutoFulfillEnabledChange} />
          </S.ToggleRow>
          <Text variant="caption" color="text.tertiary">
            {t('amazon:amazon.autoFulfill.autoFulfillEnabledHint')}
          </Text>
          <ModernTextInput
            name="autoFulfillCapTotal"
            type="number"
            label={t('amazon:amazon.autoFulfill.autoFulfillCapTotal')}
            placeholder={t('amazon:amazon.autoFulfill.autoFulfillCapTotalPlaceholder')}
            value={fields.autoFulfillCapTotal}
            onChange={onFieldChange('autoFulfillCapTotal')}
          />
          <Text variant="caption" color="text.tertiary">
            {t('amazon:amazon.autoFulfill.autoFulfillCapTotalHint')}
          </Text>
        </S.FormCard>
      </S.BodyStack>
    </Drawer>
  );
};

AmazonAccountDrawerComponent.displayName = 'AmazonAccountDrawerComponent';
