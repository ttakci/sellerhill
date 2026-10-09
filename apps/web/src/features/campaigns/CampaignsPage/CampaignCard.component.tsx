import { Badge, Icon, Text, Tooltip } from '@repo/ui';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './CampaignsPage.style';
import type { CampaignCardProps } from './CampaignsPage.types';

/**
 * One campaign in the grid — the listing-jobs card's anatomy. The whole card
 * opens the campaign (Enter / Space too), so there is no separate button.
 */
export function CampaignCard({ campaign, onOpen }: CampaignCardProps) {
  const { t } = useTranslation(['campaigns', 'translation']);
  const facts = [
    { label: t('campaigns.campaign.strategy'), value: campaign.strategy },
    { label: t('campaigns.campaign.rateType'), value: campaign.rateType },
    { label: t('campaigns.campaign.defaultRate'), value: campaign.defaultRate },
    { label: t('campaigns.campaign.listingCounts'), value: campaign.listingCount },
  ];
  return (
    <S.CampaignCard
      variant="elevated"
      role="button"
      tabIndex={0}
      aria-label={campaign.name}
      onClick={() => onOpen(campaign.campaignId)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(campaign.campaignId);
        }
      }}
    >
      <S.CardTop>
        <S.CardHeader>
          <S.CardBadges>
            <Badge variant={campaign.statusTone} size="sm" solid>
              {campaign.status}
            </Badge>
            {campaign.outsideSellerHill && (
              <Badge variant="info" size="sm">
                {t('campaigns.campaign.outsideSellerHill')}
              </Badge>
            )}
            {campaign.readOnly && (
              <Badge variant="neutral" size="sm">
                {t('campaigns.readOnly.title')}
              </Badge>
            )}
          </S.CardBadges>
          <S.TitleSlot>
            <Tooltip content={campaign.name} position="top" variant="dark">
              <S.CardTitle variant="body" weight="semibold" color="text.primary">
                {campaign.name}
              </S.CardTitle>
            </Tooltip>
          </S.TitleSlot>
        </S.CardHeader>

        <S.CardBody>
          <S.MetaList>
            {facts.map((fact) => (
              <Fragment key={fact.label}>
                <S.MetaLabel>
                  <Text variant="body-sm" color="text.secondary">
                    {fact.label}
                  </Text>
                </S.MetaLabel>
                <S.MetaValue>
                  <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                    {fact.value}
                  </Text>
                </S.MetaValue>
              </Fragment>
            ))}
          </S.MetaList>
          <S.Signal>
            <Text variant="caption" color="text.secondary">
              {campaign.roas.label}
            </Text>
            <Text
              variant="metric-lg"
              weight="bold"
              numeric
              color={campaign.roas.known ? 'brand.primary' : 'text.tertiary'}
            >
              {campaign.roas.value}
            </Text>
          </S.Signal>
        </S.CardBody>
      </S.CardTop>

      <S.StatsRow>
        {campaign.stats.map((stat) => (
          <S.StatCell key={stat.key}>
            <S.StatLabel variant="caption" color="text.secondary">
              {stat.label}
            </S.StatLabel>
            <Text variant="body" weight="semibold" numeric>
              {stat.value}
            </Text>
          </S.StatCell>
        ))}
        <S.DetailHint>
          <Text variant="caption" weight="semibold" color="brand.primary">
            {t('translation:common.details')}
          </Text>
          <Icon name="chevron-right" size={16} color="brand.primary" />
        </S.DetailHint>
      </S.StatsRow>
    </S.CampaignCard>
  );
}
