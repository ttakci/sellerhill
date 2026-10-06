import { Button, EmptyState, PageHeader, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './CampaignsPage.style';
import type { CampaignsPageProps } from './CampaignsPage.types';

export function CampaignsPageComponent({
  campaigns,
  hasStore,
  isLoading,
  errorKey,
  onRetry,
  onOpen,
}: CampaignsPageProps) {
  const { t } = useTranslation(['campaigns', 'translation']);

  return (
    <S.Container>
      <PageHeader title={t('campaigns.list.title')} subtitle={t('campaigns.list.subtitle')} />
      {!hasStore ? (
        <EmptyState icon="storefront" title={t('campaigns.list.title')} description={t('campaigns.empty.noStore')} />
      ) : isLoading ? (
        <EmptyState
          icon="chart-line"
          title={t('translation:common.loading')}
          description={t('campaigns.list.subtitle')}
        />
      ) : errorKey ? (
        <EmptyState
          iconTone="error"
          title={t('campaigns.errors.load')}
          description={t(errorKey)}
          action={t('campaigns.actions.retry')}
          onAction={onRetry}
        />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon="chart-line"
          title={t('campaigns.empty.title')}
          description={t('campaigns.empty.description')}
        />
      ) : (
        <S.CampaignList>
          {campaigns.map((campaign) => (
            <S.CampaignRow key={campaign.campaignId} variant="bordered" padding="lg">
              <S.Summary>
                <Text variant="h4" weight="semibold">
                  {campaign.name}
                </Text>
                <Text variant="body-sm" muted numeric>
                  {t('campaigns.campaign.listings')}: {campaign.sellerHillListingCount}
                </Text>
              </S.Summary>
              <Button variant="text" size="small" onClick={() => onOpen(campaign.campaignId)}>
                <Text variant="body-sm">{t('campaigns.detail.title')}</Text>
              </Button>
            </S.CampaignRow>
          ))}
        </S.CampaignList>
      )}
    </S.Container>
  );
}
