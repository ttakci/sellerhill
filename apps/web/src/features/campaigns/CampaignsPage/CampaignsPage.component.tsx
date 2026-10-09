import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Icon,
  InfoMessage,
  PageHeader,
  SearchField,
  Text,
  type TableColumn,
} from '@repo/ui';
import { Trans, useTranslation } from 'react-i18next';

import { CreateCampaignDrawerContainer } from '../drawers/CreateCampaignDrawer/CreateCampaignDrawer.container';
import * as H from '../shared/campaignSurfaces.style';

import { CampaignCard } from './CampaignCard.component';
import * as S from './CampaignsPage.style';
import type { CampaignsPageProps, CampaignView } from './CampaignsPage.types';

import { StatusTabs, type StatusTabColor } from '@/components/StatusTabs';

/** One colour per `CampaignTab`, in order: all · running · paused · ended (the card badge colours). */
const TAB_COLORS: readonly StatusTabColor[] = [
  'colors.brand.primary',
  'colors.semantic.success',
  'colors.semantic.warning',
  'colors.badge.navy',
];

export function CampaignsPageComponent({
  campaigns,
  metrics,
  metricsPending,
  hasStore,
  isLoading,
  errorKey,
  eligibilityMessage,
  canCreate,
  viewMode,
  onViewModeChange,
  tab,
  tabItems,
  onTabChange,
  search,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  resultCount,
  sortOptions,
  sortValue,
  onSortChange,
  onRetry,
  onOpen,
  onCreate,
  drawerStoreId,
  onCloseDrawer,
}: CampaignsPageProps) {
  const { t } = useTranslation(['campaigns', 'translation', 'listings']);
  const figure = (value: string) => (
    <Text variant="body-sm" numeric>
      {value}
    </Text>
  );
  const columns: TableColumn<CampaignView>[] = [
    {
      key: 'name',
      header: t('campaigns.campaign.name'),
      render: (_value, row) => (
        <S.NameCell>
          <Text variant="body-sm" weight="semibold">
            {row.name}
          </Text>
          {(row.outsideSellerHill || row.readOnly) && (
            <S.BadgeRow>
              {row.outsideSellerHill && (
                <Badge variant="info" size="sm">
                  {t('campaigns.campaign.outsideSellerHill')}
                </Badge>
              )}
              {row.readOnly && (
                <Badge variant="neutral" size="sm">
                  {t('campaigns.readOnly.title')}
                </Badge>
              )}
            </S.BadgeRow>
          )}
        </S.NameCell>
      ),
    },
    {
      key: 'status',
      header: t('campaigns.campaign.status'),
      width: '8rem',
      render: (_value, row) => (
        <Badge variant={row.statusTone} size="sm" solid>
          {row.status}
        </Badge>
      ),
    },
    {
      key: 'strategy',
      header: t('campaigns.campaign.strategy'),
      render: (_value, row) => <Text variant="body-sm">{row.strategy}</Text>,
    },
    {
      key: 'defaultRate',
      header: t('campaigns.campaign.defaultRate'),
      align: 'right',
      render: (_value, row) => figure(row.defaultRate),
    },
    {
      key: 'listingCount',
      header: t('campaigns.campaign.listingCounts'),
      align: 'right',
      render: (_value, row) => figure(row.listingCount),
    },
    {
      key: 'sales',
      header: t('campaigns.list.metrics.sales'),
      align: 'right',
      render: (_value, row) => figure(row.stats[0].value),
    },
    {
      key: 'adFees',
      header: t('campaigns.list.metrics.adFees'),
      align: 'right',
      render: (_value, row) => figure(row.stats[1].value),
    },
    {
      key: 'roas',
      header: t('campaigns.list.metrics.roas'),
      align: 'right',
      render: (_value, row) => (
        <Text variant="body-sm" weight="semibold" numeric color="brand.primary">
          {row.roas.value}
        </Text>
      ),
    },
  ];

  return (
    <S.Container>
      <PageHeader title={t('campaigns.list.title')} subtitle={t('campaigns.list.subtitle')} />
      {!hasStore ? (
        <EmptyState icon="storefront" title={t('campaigns.list.title')} description={t('campaigns.empty.noStore')} />
      ) : errorKey ? (
        <EmptyState
          iconTone="error"
          title={t('campaigns.errors.load')}
          description={t(errorKey)}
          actionIcon="refresh"
          action={t('campaigns.actions.retry')}
          onAction={onRetry}
        />
      ) : isLoading ? (
        <EmptyState
          icon="chart-line"
          title={t('translation:common.loading')}
          description={t('campaigns.list.subtitle')}
        />
      ) : (
        <>
          <H.SummaryHero variant="elevated">
            <H.SummaryTop>
              <H.HeroTitle>
                <H.HeroHeading variant="h2" weight="bold">
                  {t('campaigns.list.period')}
                </H.HeroHeading>
                <Text variant="body-sm" color="text.secondary">
                  {t('campaigns.list.summaryHint')}
                </Text>
              </H.HeroTitle>
              <H.SummaryActions>
                <Button variant="primary" size="small" onClick={onCreate} disabled={!canCreate}>
                  <Icon name="plus" size={16} />
                  <Text variant="body-sm">{t('campaigns.actions.create')}</Text>
                </Button>
              </H.SummaryActions>
            </H.SummaryTop>
            <H.KpiSection>
              <H.KpiStrip>
                {metrics.map((metric) => (
                  <H.KpiItem key={metric.key}>
                    <H.KpiLabel variant="caption" color="text.secondary">
                      {metric.label}
                    </H.KpiLabel>
                    <Text
                      variant="metric"
                      weight="bold"
                      numeric
                      color={!metric.known ? 'text.tertiary' : metric.key === 'roas' ? 'brand.primary' : 'text.primary'}
                    >
                      {metric.value}
                    </Text>
                  </H.KpiItem>
                ))}
              </H.KpiStrip>
              {metricsPending && (
                <Text variant="caption" color="text.tertiary">
                  {t('campaigns.detail.metricsNote')}
                </Text>
              )}
              <H.HeroNotices>
                {eligibilityMessage && (
                  <InfoMessage type="info">
                    <Text variant="body-sm">{eligibilityMessage}</Text>
                  </InfoMessage>
                )}
              </H.HeroNotices>
            </H.KpiSection>
          </H.SummaryHero>

          <S.TabsRow>
            <StatusTabs
              $colors={TAB_COLORS}
              items={tabItems}
              value={tab}
              onChange={onTabChange}
              variant="underline"
              ariaLabel={t('campaigns.list.tabs.ariaLabel')}
            />
          </S.TabsRow>

          <S.FilterBarRow>
            <S.SearchWrapper>
              <SearchField
                value={search}
                onChange={onSearchChange}
                placeholder={t('campaigns.list.search')}
                aria-label={t('campaigns.list.search')}
                size="small"
                fullWidth
              />
            </S.SearchWrapper>
            {hasActiveFilters && (
              <S.FilterActions>
                <Button variant="text" size="small" onClick={onClearFilters}>
                  <Text variant="body">{t('listings:listings.filters.clearAll')}</Text>
                </Button>
              </S.FilterActions>
            )}
          </S.FilterBarRow>

          <DataTable
            data={campaigns}
            columns={columns}
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            sortOptions={sortOptions}
            sortValue={sortValue}
            onSortChange={onSortChange}
            sortLabel={t('listings:listings.filters.sortLabel')}
            resultLabel={
              <Trans
                i18nKey="listings.filters.resultListed"
                ns="listings"
                values={{ count: resultCount }}
                components={{
                  b: (
                    <Text variant="body-sm" weight="bold" color="text.primary">
                      {null}
                    </Text>
                  ),
                }}
              />
            }
            renderGridCard={(campaign) => (
              <CampaignCard key={campaign.campaignId} campaign={campaign} onOpen={onOpen} />
            )}
            gridMinItemWidth="26rem"
            gridMaxColumns={2}
            onRowClick={(row) => onOpen(row.campaignId)}
            emptyContent={
              hasActiveFilters ? (
                <EmptyState
                  icon="search"
                  title={t('campaigns.list.emptyFiltered.title')}
                  description={t('campaigns.list.emptyFiltered.description')}
                  actionIcon="x"
                  action={t('campaigns.list.emptyFiltered.action')}
                  onAction={onClearFilters}
                />
              ) : (
                <EmptyState
                  icon="chart-line"
                  title={t('campaigns.empty.title')}
                  description={t('campaigns.empty.description')}
                />
              )
            }
          />
        </>
      )}
      {drawerStoreId && (
        <CreateCampaignDrawerContainer key={drawerStoreId} storeId={drawerStoreId} onClose={onCloseDrawer} />
      )}
    </S.Container>
  );
}
