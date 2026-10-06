import { Button, EmptyState, PageHeader, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './CampaignDetailPage.style';
import type { CampaignDetailPageProps } from './CampaignDetailPage.types';

export function CampaignDetailPageComponent({
  detail,
  hasStore,
  isLoading,
  errorKey,
  onRetry,
  onBack,
}: CampaignDetailPageProps) {
  const { t } = useTranslation(['campaigns', 'translation']);

  return (
    <S.Container>
      <PageHeader
        title={detail?.campaign.name ?? t('campaigns.detail.title')}
        subtitle={t('campaigns.detail.subtitle')}
      />
      <Button variant="text" size="small" onClick={onBack}>
        <Text variant="body-sm">{t('campaigns.actions.back')}</Text>
      </Button>
      {!hasStore ? (
        <EmptyState icon="storefront" title={t('campaigns.detail.title')} description={t('campaigns.empty.noStore')} />
      ) : isLoading ? (
        <EmptyState
          icon="chart-line"
          title={t('translation:common.loading')}
          description={t('campaigns.detail.subtitle')}
        />
      ) : errorKey ? (
        <EmptyState
          iconTone="error"
          title={t('campaigns.errors.load')}
          description={t(errorKey)}
          action={t('campaigns.actions.retry')}
          onAction={onRetry}
        />
      ) : detail ? (
        <S.Members variant="bordered" padding="lg">
          <Text variant="h4" weight="semibold">
            {t('campaigns.members.title')}
          </Text>
          <Text variant="body-sm" numeric>
            {t('campaigns.campaign.listings')}: {detail.listings.length}
          </Text>
          {detail.listings.map((listing) => (
            <Text key={listing.listingId} variant="body-sm">
              {listing.title}
            </Text>
          ))}
        </S.Members>
      ) : null}
    </S.Container>
  );
}
