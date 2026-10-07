import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  InfoMessage,
  PageHeader,
  Text,
  type TableColumn,
} from '@repo/ui';
import { useTranslation } from 'react-i18next';

import { CreateCampaignDrawerContainer } from '../drawers/CreateCampaignDrawer/CreateCampaignDrawer.container';

import { CampaignCard } from './CampaignCard.component';
import * as S from './CampaignsPage.style';
import type { CampaignsPageProps, CampaignView } from './CampaignsPage.types';

export function CampaignsPageComponent({
  campaigns,
  metrics,
  hasStore,
  isLoading,
  errorKey,
  eligibilityMessage,
  canCreate,
  viewMode,
  gridMinItemWidth,
  onViewModeChange,
  onRetry,
  onOpen,
  onCreate,
  drawerStoreId,
  onCloseDrawer,
}: CampaignsPageProps) {
  const { t } = useTranslation(['campaigns', 'translation']);
  const columns: TableColumn<CampaignView>[] = [
    {
      key: 'name',
      header: t('campaigns.campaign.name'),
      render: (_value, row) => (
        <S.Stack>
          <Button variant="text" size="small" onClick={() => onOpen(row.campaignId)}>
            <Text variant="body-sm" weight="semibold">
              {row.name}
            </Text>
          </Button>
          <S.BadgeRow>
            {row.outsideSellerHill && (
              <Badge variant="info">
                <Text variant="caption">{t('campaigns.campaign.outsideSellerHill')}</Text>
              </Badge>
            )}
            {row.readOnly && (
              <Badge variant="neutral">
                <Text variant="caption">{t('campaigns.readOnly.title')}</Text>
              </Badge>
            )}
          </S.BadgeRow>
        </S.Stack>
      ),
    },
    {
      key: 'status',
      header: t('campaigns.campaign.status'),
      render: (_value, row) => (
        <Badge variant={row.statusTone}>
          <Text variant="caption">{row.status}</Text>
        </Badge>
      ),
    },
    {
      key: 'strategy',
      header: t('campaigns.campaign.strategy'),
      render: (_value, row) => <Text variant="body-sm">{row.strategy}</Text>,
    },
    {
      key: 'rateType',
      header: t('campaigns.campaign.rateType'),
      render: (_value, row) => <Text variant="body-sm">{row.rateType}</Text>,
    },
    {
      key: 'defaultRate',
      header: t('campaigns.campaign.defaultRate'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" numeric>
          {row.defaultRate}
        </Text>
      ),
    },
    {
      key: 'listingCount',
      header: t('campaigns.campaign.listingCounts'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" numeric>
          {row.listingCount}
        </Text>
      ),
    },
    {
      key: 'sales',
      header: t('campaigns.list.metrics.sales'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" numeric>
          {row.metrics[0].value}
        </Text>
      ),
    },
    {
      key: 'adFees',
      header: t('campaigns.list.metrics.adFees'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" numeric>
          {row.metrics[1].value}
        </Text>
      ),
    },
    {
      key: 'roas',
      header: t('campaigns.list.metrics.roas'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" numeric>
          {row.metrics[2].value}
        </Text>
      ),
    },
  ];
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
      ) : (
        <S.Stack>
          {eligibilityMessage && (
            <InfoMessage type="info">
              <Text variant="body-sm">{eligibilityMessage}</Text>
            </InfoMessage>
          )}
          <Text variant="h2" weight="semibold">
            {t('campaigns.list.period')}
          </Text>
          <S.Kpis>
            {metrics.map((metric) => (
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
          </S.Kpis>
          <DataTable
            data={campaigns}
            columns={columns}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            renderGridCard={(campaign) => (
              <CampaignCard key={campaign.campaignId} campaign={campaign} onOpen={onOpen} />
            )}
            gridMinItemWidth={gridMinItemWidth}
            gridMaxColumns={3}
            actions={
              <Button onClick={onCreate} disabled={!canCreate}>
                <Text variant="body-sm">{t('campaigns.actions.create')}</Text>
              </Button>
            }
            emptyContent={
              <EmptyState
                icon="chart-line"
                title={t('campaigns.empty.title')}
                description={t('campaigns.empty.description')}
              />
            }
          />
        </S.Stack>
      )}
      {drawerStoreId && (
        <CreateCampaignDrawerContainer key={drawerStoreId} storeId={drawerStoreId} onClose={onCloseDrawer} />
      )}
    </S.Container>
  );
}
