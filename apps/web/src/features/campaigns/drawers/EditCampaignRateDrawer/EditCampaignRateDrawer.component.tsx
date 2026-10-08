import { Drawer, InfoMessage, ModernTextInput, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './EditCampaignRateDrawer.style';
import type { EditCampaignRateDrawerComponentProps } from './EditCampaignRateDrawer.types';

export function EditCampaignRateDrawerComponent({
  isDefault,
  isRetry,
  rate,
  rateError,
  feedback,
  failedMembers,
  isSaving,
  writable,
  onRateChange,
  onSubmit,
  onClose,
}: EditCampaignRateDrawerComponentProps) {
  const { t } = useTranslation(['campaigns']);
  return (
    <Drawer
      isOpen
      onClose={onClose}
      title={t(isDefault ? 'campaigns.rate.defaultTitle' : 'campaigns.rate.title')}
      primaryAction={{
        icon: isRetry ? 'refresh' : 'save',
        label: t(isRetry ? 'campaigns.rate.retryMembers' : 'campaigns.actions.save'),
        onClick: onSubmit,
        isLoading: isSaving,
        disabled: isSaving || !writable,
      }}
    >
      <S.Form variant="bordered" padding="lg">
        <ModernTextInput
          name="campaignRate"
          id="campaignRate"
          label={t('campaigns.create.rate')}
          value={rate}
          onChange={onRateChange}
          errorMessage={rateError}
          isDisabled={isSaving || !writable}
        />
        <Text variant="caption" muted>
          {t('campaigns.create.rateHint')}
        </Text>
        {feedback && (
          <InfoMessage type="info">
            <Text variant="body-sm">{feedback}</Text>
          </InfoMessage>
        )}
        {failedMembers.length > 0 && <Text variant="body-sm">{t('campaigns.results.retryHint')}</Text>}
        {failedMembers.map((member) => (
          <Text key={member.listingId} variant="body-sm">
            {member.title}
          </Text>
        ))}
      </S.Form>
    </Drawer>
  );
}
