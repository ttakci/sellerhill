import { Badge, Button, Text } from '@repo/ui';
import { useTranslation } from 'react-i18next';

import * as S from './CampaignsPage.style';
import type { CampaignView } from './CampaignsPage.types';

export function CampaignCard({ campaign, onOpen }: { campaign: CampaignView; onOpen: (id: string) => void }) {
  const { t } = useTranslation(['campaigns']);
  return (
    <S.CampaignCard variant="bordered" padding="lg">
      <S.BadgeRow>
        <Badge variant={campaign.statusTone} size="sm">
          <Text variant="caption">{campaign.status}</Text>
        </Badge>
        {campaign.outsideSellerHill && (
          <Badge variant="info" size="sm">
            <Text variant="caption">{t('campaigns.campaign.outsideSellerHill')}</Text>
          </Badge>
        )}
        {campaign.readOnly && (
          <Badge variant="neutral" size="sm">
            <Text variant="caption">{t('campaigns.readOnly.title')}</Text>
          </Badge>
        )}
      </S.BadgeRow>
      <Text variant="h4" weight="semibold">
        {campaign.name}
      </Text>
      <S.Facts>
        <S.Fact>
          <Text variant="caption" muted>
            {t('campaigns.campaign.strategy')}
          </Text>
          <Text variant="body-sm">{campaign.strategy}</Text>
        </S.Fact>
        <S.Fact>
          <Text variant="caption" muted>
            {t('campaigns.campaign.rateType')}
          </Text>
          <Text variant="body-sm">{campaign.rateType}</Text>
        </S.Fact>
        <S.Fact>
          <Text variant="caption" muted>
            {t('campaigns.campaign.defaultRate')}
          </Text>
          <Text variant="body-sm" numeric>
            {campaign.defaultRate}
          </Text>
        </S.Fact>
        <S.Fact>
          <Text variant="caption" muted>
            {t('campaigns.campaign.listingCounts')}
          </Text>
          <Text variant="body-sm" numeric>
            {campaign.listingCount}
          </Text>
        </S.Fact>
      </S.Facts>
      <S.Facts>
        {campaign.metrics.map((metric) => (
          <S.Fact key={metric.key}>
            <Text variant="caption" muted>
              {metric.label}
            </Text>
            <Text variant="metric-sm" numeric>
              {metric.value}
            </Text>
          </S.Fact>
        ))}
      </S.Facts>
      <Button variant="text" size="small" onClick={() => onOpen(campaign.campaignId)}>
        <Text variant="body-sm">{t('campaigns.detail.title')}</Text>
      </Button>
    </S.CampaignCard>
  );
}
