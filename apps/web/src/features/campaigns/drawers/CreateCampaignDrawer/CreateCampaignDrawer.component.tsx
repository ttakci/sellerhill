import { Drawer, InfoMessage, ModernTextInput, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './CreateCampaignDrawer.style';
import type { CreateCampaignDrawerComponentProps } from './CreateCampaignDrawer.types';

export function CreateCampaignDrawerComponent({
  name,
  rate,
  nameError,
  rateError,
  error,
  isSaving,
  onNameChange,
  onRateChange,
  onSubmit,
  onClose,
}: CreateCampaignDrawerComponentProps) {
  const { t } = useTranslation(['campaigns']);
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={t('campaigns.create.title')}
      primaryAction={{
        icon: 'plus',
        label: t('campaigns.actions.create'),
        onClick: onSubmit,
        isLoading: isSaving,
        disabled: isSaving,
      }}
    >
      <S.Form variant="bordered" padding="lg">
        <ModernTextInput
          name="campaignName"
          id="campaignName"
          label={t('campaigns.create.name')}
          value={name}
          onChange={onNameChange}
          errorMessage={nameError}
          isDisabled={isSaving}
        />
        <ModernTextInput
          name="campaignRate"
          id="campaignRate"
          label={t('campaigns.create.rate')}
          value={rate}
          onChange={onRateChange}
          errorMessage={rateError}
          isDisabled={isSaving}
        />
        <Text variant="caption" muted>
          {t('campaigns.create.rateHint')}
        </Text>
        {error && (
          <InfoMessage type="error">
            <Text variant="body-sm">{error}</Text>
          </InfoMessage>
        )}
      </S.Form>
    </Drawer>
  );
}
