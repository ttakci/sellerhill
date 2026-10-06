import { CampaignAction } from '@repo/shared';
import {
  Badge,
  Button,
  Card,
  ConfirmModal,
  DataTable,
  EmptyState,
  InfoMessage,
  PageHeader,
  Text,
  type TableColumn,
} from '@repo/ui';
import { useTranslation } from 'react-i18next';

import { AddCampaignListingsDrawerContainer } from '../drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.container';
import { EditCampaignRateDrawerContainer } from '../drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.container';

import * as S from './CampaignDetailPage.style';
import type { CampaignDetailPageProps, CampaignMemberView } from './CampaignDetailPage.types';

export function CampaignDetailPageComponent(props: CampaignDetailPageProps) {
  const { t } = useTranslation(['campaigns', 'translation']);
  const columns: TableColumn<CampaignMemberView>[] = [
    {
      key: 'title',
      header: t('campaigns.members.product'),
      render: (_value, member) => (
        <S.Product>
          {member.imageUrl && <S.Image src={member.imageUrl} alt="" />}
          <S.Stack>
            <Text variant="body-sm" weight="semibold">
              {member.title}
            </Text>
            <Text variant="caption" muted>
              {member.ebayItemId}
            </Text>
          </S.Stack>
        </S.Product>
      ),
    },
    {
      key: 'price',
      header: t('campaigns.members.price'),
      align: 'right',
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
      render: (_value, member) => (
        <S.Stack>
          <Text variant="body-sm" numeric>
            {member.rateText}
          </Text>
          {member.note && (
            <Text variant="caption" muted>
              {member.note}
            </Text>
          )}
          <Button
            variant="text"
            size="small"
            disabled={!props.writable || props.busy}
            onClick={() => props.onRateOpen(member)}
          >
            <Text variant="body-sm">{t('campaigns.members.editRate', { title: member.title })}</Text>
          </Button>
        </S.Stack>
      ),
    },
    {
      key: 'actions',
      header: t('campaigns.members.actions'),
      render: (_value, member) => (
        <Button
          variant="text"
          size="small"
          disabled={!props.writable || props.busy}
          onClick={() => props.onRemove([member])}
        >
          <Text variant="body-sm">{t('campaigns.members.remove', { title: member.title })}</Text>
        </Button>
      ),
    },
  ];
  return (
    <S.Container>
      <PageHeader
        title={props.detail?.campaign.name ?? t('campaigns.detail.title')}
        subtitle={t('campaigns.detail.subtitle')}
      />
      <Button variant="text" size="small" onClick={props.onBack}>
        <Text variant="body-sm">{t('campaigns.actions.back')}</Text>
      </Button>
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
          action={t('campaigns.actions.retry')}
          onAction={props.onRetry}
        />
      ) : (
        props.detail && (
          <S.Stack>
            {props.writeReason && (
              <InfoMessage type="warning">
                <Text variant="body-sm">{props.writeReason}</Text>
              </InfoMessage>
            )}
            <S.Panel variant="bordered" padding="lg">
              {props.campaignView?.outsideSellerHill && (
                <Badge variant="info">
                  <Text variant="caption">{t('campaigns.campaign.outsideSellerHill')}</Text>
                </Badge>
              )}
              <S.Facts>
                {props.facts.map((fact) => (
                  <S.Fact key={fact.label}>
                    <Text variant="caption" muted>
                      {fact.label}
                    </Text>
                    <Text variant="body-sm" numeric>
                      {fact.value}
                    </Text>
                  </S.Fact>
                ))}
              </S.Facts>
              <S.Row>
                <Button disabled={!props.writable || props.busy} onClick={props.onAddOpen}>
                  <Text variant="body-sm">{t('campaigns.actions.addListings')}</Text>
                </Button>
                <Button variant="secondary" disabled={!props.writable || props.busy} onClick={() => props.onRateOpen()}>
                  <Text variant="body-sm">{t('campaigns.rate.defaultTitle')}</Text>
                </Button>
                {props.lifecycleAction && (
                  <Button
                    variant="secondary"
                    disabled={!props.writable || props.busy}
                    onClick={() => props.onAction(props.lifecycleAction as CampaignAction)}
                  >
                    <Text variant="body-sm">
                      {t(
                        props.lifecycleAction === CampaignAction.PAUSE
                          ? 'campaigns.actions.pause'
                          : 'campaigns.actions.resume'
                      )}
                    </Text>
                  </Button>
                )}
                <Button variant="secondary" disabled={!props.writable || props.busy} onClick={props.onEndOpen}>
                  <Text variant="body-sm">{t('campaigns.actions.end')}</Text>
                </Button>
              </S.Row>
              {props.feedback && (
                <InfoMessage type="info">
                  <Text variant="body-sm">{props.feedback}</Text>
                </InfoMessage>
              )}
            </S.Panel>
            <Text variant="h2" weight="semibold">
              {t('campaigns.list.period')}
            </Text>
            <S.Facts>
              {props.metrics.map((metric) => (
                <Card key={metric.key} variant="stat" padding="lg">
                  <S.Fact>
                    <Text variant="caption" muted>
                      {metric.label}
                    </Text>
                    <Text variant="metric" numeric>
                      {metric.value}
                    </Text>
                  </S.Fact>
                </Card>
              ))}
            </S.Facts>
            <Text variant="caption" muted>
              {t('campaigns.detail.metricsNote')}
            </Text>
            <Text variant="h2" weight="semibold">
              {t('campaigns.members.title')}
            </Text>
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
                  variant="secondary"
                  disabled={!props.writable || props.busy || !props.selectedRows.length}
                  onClick={() => props.onRemove(props.selectedRows)}
                >
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
