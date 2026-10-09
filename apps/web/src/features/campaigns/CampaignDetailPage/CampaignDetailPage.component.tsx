import { CampaignAction } from '@repo/shared';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  DataTable,
  EmptyState,
  Icon,
  IconButton,
  InfoMessage,
  PageHeader,
  Text,
  type TableColumn,
} from '@repo/ui';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import { AddCampaignListingsDrawerContainer } from '../drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.container';
import { EditCampaignRateDrawerContainer } from '../drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.container';
import * as H from '../shared/campaignSurfaces.style';

import * as S from './CampaignDetailPage.style';
import type { CampaignDetailPageProps, CampaignMemberView } from './CampaignDetailPage.types';

import { ProductTableCell } from '@/domain-ui';

export function CampaignDetailPageComponent(props: CampaignDetailPageProps) {
  const { t } = useTranslation(['campaigns', 'translation', 'listings']);
  const columns: TableColumn<CampaignMemberView>[] = [
    {
      key: 'title',
      header: t('campaigns.members.product'),
      width: '20.5rem',
      render: (_value, member) => (
        <ProductTableCell
          title={member.title}
          imageUrl={member.imageUrl ?? undefined}
          meta={
            member.ebayItemId
              ? [{ label: t('listings:listings.table.ebayId'), id: member.ebayItemId, storeType: 'ebay' }]
              : []
          }
        />
      ),
    },
    {
      key: 'price',
      header: t('campaigns.members.price'),
      align: 'right',
      width: '7rem',
      render: (_value, member) => (
        <Text variant="body-sm" numeric>
          {member.priceText}
        </Text>
      ),
    },
    {
      key: 'adRate',
      header: t('campaigns.members.rate'),
      align: 'right',
      width: '12rem',
      render: (_value, member) => (
        <S.RateCell>
          <S.Fact>
            <Text variant="body-sm" numeric>
              {member.rateText}
            </Text>
            {member.note && (
              <Text variant="caption" muted>
                {member.note}
              </Text>
            )}
          </S.Fact>
          <IconButton
            variant="ghost"
            aria-label={t('campaigns.members.editRate', { title: member.title })}
            disabled={!props.writable || props.busy}
            onClick={() => props.onRateOpen(member)}
          >
            <Icon name="edit" size={16} color="brand.primary" />
          </IconButton>
        </S.RateCell>
      ),
    },
    {
      key: 'actions',
      header: t('campaigns.members.actions'),
      align: 'right',
      width: '5rem',
      render: (_value, member) => (
        <IconButton
          variant="ghost"
          aria-label={t('campaigns.members.remove', { title: member.title })}
          disabled={!props.writable || props.busy}
          onClick={() => props.onRemove([member])}
        >
          <Icon name="trash" size={16} color="semantic.error" />
        </IconButton>
      ),
    },
  ];
  return (
    <S.Container>
      <PageHeader title={t('campaigns.detail.title')} subtitle={t('campaigns.detail.subtitle')} />
      <S.BackRow>
        <Button variant="text" size="small" onClick={props.onBack}>
          <Icon name="arrow-left" size={16} />
          <Text variant="body-sm">{t('campaigns.actions.back')}</Text>
        </Button>
      </S.BackRow>
      {!props.hasStore ? (
        <EmptyState icon="storefront" title={t('campaigns.detail.title')} description={t('campaigns.empty.noStore')} />
      ) : props.isLoading ? (
        <EmptyState
          icon="chart-line"
          title={t('translation:common.loading')}
          description={t('campaigns.detail.subtitle')}
        />
      ) : props.errorKey ? (
        <EmptyState
          iconTone="error"
          title={t('campaigns.errors.load')}
          description={t(props.errorKey)}
          actionIcon="refresh"
          action={t('campaigns.actions.retry')}
          onAction={props.onRetry}
        />
      ) : (
        props.detail && (
          <S.Stack>
            <H.Hero variant="elevated">
              <H.HeroBadges>
                {props.campaignView && (
                  <Badge variant={props.campaignView.statusTone} size="sm" solid>
                    {props.campaignView.status}
                  </Badge>
                )}
                {props.campaignView?.outsideSellerHill && (
                  <Badge variant="info" size="sm">
                    {t('campaigns.campaign.outsideSellerHill')}
                  </Badge>
                )}
                {props.campaignView?.readOnly && (
                  <Badge variant="neutral" size="sm">
                    {t('campaigns.readOnly.title')}
                  </Badge>
                )}
              </H.HeroBadges>
              <H.HeroTitle>
                <H.HeroHeading variant="h2" weight="bold">
                  {props.detail.campaign.name}
                </H.HeroHeading>
              </H.HeroTitle>
              <H.FactList>
                {props.facts.map((fact) => (
                  <Fragment key={fact.label}>
                    <H.FactLabel>
                      <Text variant="body-sm" color="text.secondary">
                        {fact.label}
                      </Text>
                    </H.FactLabel>
                    <H.FactValue>
                      <Text variant="body-sm" weight="bold" numeric>
                        {fact.value}
                      </Text>
                    </H.FactValue>
                  </Fragment>
                ))}
              </H.FactList>
              <H.HeroActions>
                <Button
                  variant="primary"
                  size="small"
                  disabled={!props.writable || props.busy}
                  onClick={props.onAddOpen}
                >
                  <Icon name="plus" size={16} />
                  <Text variant="body-sm">{t('campaigns.actions.addListings')}</Text>
                </Button>
                <Button
                  variant="teal"
                  size="small"
                  disabled={!props.writable || props.busy}
                  onClick={() => props.onRateOpen()}
                >
                  <Icon name="percent" size={16} />
                  <Text variant="body-sm">{t('campaigns.rate.defaultTitle')}</Text>
                </Button>
                {props.lifecycleAction && (
                  <Button
                    variant={props.lifecycleAction === CampaignAction.PAUSE ? 'orange' : 'success'}
                    size="small"
                    disabled={!props.writable || props.busy}
                    onClick={() => props.onAction(props.lifecycleAction as CampaignAction)}
                  >
                    <Icon name={props.lifecycleAction === CampaignAction.PAUSE ? 'pause' : 'play-arrow'} size={16} />
                    <Text variant="body-sm">
                      {t(
                        props.lifecycleAction === CampaignAction.PAUSE
                          ? 'campaigns.actions.pause'
                          : 'campaigns.actions.resume'
                      )}
                    </Text>
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="small"
                  disabled={!props.writable || props.busy}
                  onClick={props.onEndOpen}
                >
                  <Icon name="block" size={16} />
                  <Text variant="body-sm">{t('campaigns.actions.end')}</Text>
                </Button>
              </H.HeroActions>
              <H.KpiSection>
                <Text variant="caption" weight="semibold" color="text.secondary">
                  {t('campaigns.list.period')}
                </Text>
                <H.KpiStrip>
                  {props.metrics.map((metric) => (
                    <H.KpiItem key={metric.key}>
                      <H.KpiLabel variant="caption" color="text.secondary">
                        {metric.label}
                      </H.KpiLabel>
                      <Text
                        variant="metric"
                        weight="bold"
                        numeric
                        color={
                          !metric.known ? 'text.tertiary' : metric.key === 'roas' ? 'brand.primary' : 'text.primary'
                        }
                      >
                        {metric.value}
                      </Text>
                    </H.KpiItem>
                  ))}
                </H.KpiStrip>
                {props.metrics.some((metric) => !metric.known) && (
                  <Text variant="caption" color="text.tertiary">
                    {t('campaigns.detail.metricsNote')}
                  </Text>
                )}
                <H.HeroNotices>
                  {props.writeReason && (
                    <InfoMessage type="info">
                      <Text variant="body-sm">{props.writeReason}</Text>
                    </InfoMessage>
                  )}
                  {props.feedback && (
                    <InfoMessage type="info">
                      <Text variant="body-sm">{props.feedback}</Text>
                    </InfoMessage>
                  )}
                </H.HeroNotices>
              </H.KpiSection>
            </H.Hero>

            <H.SectionHeading>
              <Text variant="h3" weight="semibold">
                {t('campaigns.members.title')}
              </Text>
            </H.SectionHeading>
            <DataTable
              data={props.members}
              columns={columns}
              viewMode="table"
              hideViewToggle
              selectable={props.writable && !props.busy}
              selectedRows={props.selectedRows}
              onSelectionChange={props.onSelect}
              renderGridCard={(member) => (
                <Card variant="bordered" padding="lg">
                  <Text variant="body-sm">{member.title}</Text>
                </Card>
              )}
              actions={
                <Button
                  variant="danger"
                  disabled={!props.writable || props.busy || !props.selectedRows.length}
                  onClick={() => props.onRemove(props.selectedRows)}
                >
                  <Icon name="x" size={16} />
                  <Text variant="body-sm">{t('campaigns.actions.removeListings')}</Text>
                </Button>
              }
              emptyContent={
                <EmptyState title={t('campaigns.members.empty')} description={t('campaigns.detail.subtitle')} />
              }
            />
          </S.Stack>
        )
      )}
      {props.storeId && props.campaignId && props.addOpen && (
        <AddCampaignListingsDrawerContainer
          key={`${props.storeId}:${props.campaignId}:add`}
          storeId={props.storeId}
          campaignId={props.campaignId}
          writable={props.writable}
          onClose={props.onAddClose}
        />
      )}
      {props.storeId && props.campaignId && props.rateTarget && (
        <EditCampaignRateDrawerContainer
          key={`${props.storeId}:${props.campaignId}:${props.rateTarget.listingId ?? 'default'}`}
          storeId={props.storeId}
          campaignId={props.campaignId}
          {...props.rateTarget}
          writable={props.writable}
          onClose={props.onRateClose}
        />
      )}
      <ConfirmModal
        isOpen={props.endOpen}
        title={t('campaigns.actions.end')}
        onClose={props.onEndClose}
        onConfirm={() => props.onAction(CampaignAction.END)}
        description={<Text variant="body-sm">{t('campaigns.lifecycle.endConfirm')}</Text>}
        confirmLabel={t('campaigns.actions.end')}
        cancelLabel={t('campaigns.actions.cancel')}
        isLoading={props.busy}
      />
    </S.Container>
  );
}
