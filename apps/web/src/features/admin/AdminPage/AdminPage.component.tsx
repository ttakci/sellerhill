import {
  AdminWarningLevel,
  AspectDefaultSourceDto,
  QuotaPressureBand,
} from '@repo/shared';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  InfoMessage,
  PageHeader,
  SearchField,
  Table,
  Text,
  Tooltip,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AdminSettingsPanel } from '../components/AdminSettingsPanel';

import * as S from './AdminPage.style';
import type { AdminPageComponentProps } from './AdminPage.types';

/** Badge variant for a quota pressure band. */
const BAND_VARIANT: Record<QuotaPressureBand, 'neutral' | 'success' | 'warning' | 'error'> = {
  [QuotaPressureBand.NONE]: 'neutral',
  [QuotaPressureBand.UNDER_LIMIT]: 'success',
  [QuotaPressureBand.NEAR_LIMIT]: 'warning',
  [QuotaPressureBand.AT_LIMIT]: 'error',
  [QuotaPressureBand.OVER_LIMIT]: 'error',
};

export const AdminPageComponent = ({
  activeTab,
  listingQuality,
  overview,
  operations,
  providerCosts,
  billingMetrics,
  usersList,
  ebayBudgetRows,
  ebayUnmapped,
  ebayFigureNote,
  ebayFigureStale,
  ebayFigureMissing,
  listingFailures,
  userColumns,
  budgetColumns,
  unmappedColumns,
  failureColumns,
  skip,
  formatCost,
  formatCapturedAt,
}: AdminPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['admin', 'translation']);
  return (
    <S.Container>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {/* Section navigation lives in the operator sidebar (OperatorLayout) —
          each section is its own `/admin?tab=...` link there. This page only
          renders the content for whichever tab the URL currently selects. */}
      {activeTab === 'overview' && (
        <S.Rows>
          <S.Grid>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.overview.users')}
              </Text>
              <Text variant="metric" weight="semibold">
                {overview?.totalUsers ?? '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.overview.activeListings')}
              </Text>
              <Text variant="metric" weight="semibold">
                {overview?.activeListings ?? '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.overview.orders')}
              </Text>
              <Text variant="metric" weight="semibold">
                {overview?.ordersLast30Days ?? '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.overview.ebayStores')}
              </Text>
              <Text variant="metric" weight="semibold">
                {overview?.activeEbayStores ?? '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.overview.amazonAccounts')}
              </Text>
              <Text variant="metric" weight="semibold">
                {overview?.activeAmazonAccounts ?? '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.overview.keepaBalance')}
              </Text>
              <Text variant="metric" weight="semibold">
                {operations?.keepaTokensLeft ?? '—'}
              </Text>
            </S.SummaryCard>
          </S.Grid>

          <S.Section>
            <Text variant="h4" weight="semibold">
              {t('admin.overview.warningsTitle')}
            </Text>
            {operations && operations.warnings.length === 0 && (
              <Text variant="body-sm" color="text.secondary">
                {t('admin.overview.noWarnings')}
              </Text>
            )}
            <S.Rows>
              {operations?.warnings.map((warning, index) => (
                <S.Row key={`${warning.kind}-${warning.subject ?? index}`}>
                  <Text variant="body-sm">{t(`admin.warnings.${warning.kind}`, { subject: warning.subject })}</Text>
                  <Badge variant={warning.level === AdminWarningLevel.CRITICAL ? 'error' : 'warning'}>
                    {warning.value}
                  </Badge>
                </S.Row>
              ))}
            </S.Rows>
          </S.Section>
        </S.Rows>
      )}

      {/* Warnings live on Overview only — this tab used to repeat the exact
          same list above the queue rows. */}
      {activeTab === 'queues' && (
        <S.Rows>
          {operations?.queues.map((queue) => (
            <S.Row key={queue.name}>
              <Text variant="body" weight="semibold">
                {queue.name}
              </Text>
              <Text variant="body-sm" color="text.secondary">
                {t('admin.queue.summary', {
                  waiting: queue.waiting,
                  active: queue.active,
                  failed: queue.failedObserved,
                })}
              </Text>
            </S.Row>
          ))}
        </S.Rows>
      )}

      {activeTab === 'costs' && (
        <S.Grid>
          <S.SummaryCard>
            <Text variant="caption" color="text.secondary">
              {t('admin.cost.keepaBalance')}
            </Text>
            <Text variant="metric" weight="semibold" numeric>
              {operations?.keepaTokensLeft ?? '—'}
            </Text>
          </S.SummaryCard>
          {providerCosts.map((cost) => (
            <S.SummaryCard key={`${cost.source}-${cost.metric}`}>
              <Text variant="body" weight="semibold">
                {t(`admin.metrics.${cost.metric}`)}
              </Text>
              <Text variant="metric-sm" weight="semibold">
                {formatCost(cost.totalCostMicros, cost.currency)}
              </Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.cost.quantity', { quantity: cost.totalQuantity })}
              </Text>
            </S.SummaryCard>
          ))}
          {/* Shipments reset every provider billing window — a wait-or-upgrade
              problem, same read as the Keepa balance above it. */}
          <S.SummaryCard>
            <Text variant="caption" color="text.secondary">
              {t('admin.cost.aquilineShipments.label')}
            </Text>
            <Text variant="metric" weight="semibold" numeric>
              {t('admin.cost.of', {
                used: overview?.aquilinePlanSnapshot?.planUsed ?? '—',
                limit: overview?.aquilinePlanSnapshot?.planLimit ?? '—',
              })}
            </Text>
            <Text variant="caption" color="text.secondary">
              {t('admin.cost.aquilineShipments.caption', {
                planCode: overview?.aquilinePlanSnapshot?.planCode ?? '—',
                windowKey: overview?.aquilinePlanSnapshot?.windowKey ?? '—',
                capturedAt: formatCapturedAt(overview?.aquilinePlanSnapshot?.capturedAt ?? null),
              })}
            </Text>
          </S.SummaryCard>
          {/* Profiles NEVER reset — /v1/profiles/{id} has no DELETE, so this
              counter only ever climbs. Reading it next to shipments without a
              hint would imply it recovers the same way; it does not. */}
          <S.SummaryCard>
            <S.LabelRow>
              <Text variant="caption" color="text.secondary">
                {t('admin.cost.aquilineProfiles.label')}
              </Text>
              <Tooltip content={t('admin.cost.aquilineProfiles.hint')} position="right" variant="dark">
                <S.InfoButton
                  type="button"
                  variant="ghost"
                  aria-label={t('admin.cost.aquilineProfiles.hint')}
                >
                  <Icon name="info" size={14} color="text.tertiary" />
                </S.InfoButton>
              </Tooltip>
            </S.LabelRow>
            <S.FigureRow>
              <Text variant="metric" weight="semibold" numeric>
                {t('admin.cost.of', {
                  used: overview?.aquilinePlanSnapshot?.profilesUsed ?? '—',
                  limit: overview?.aquilinePlanSnapshot?.profilesLimit ?? '—',
                })}
              </Text>
              <Badge variant="warning">{t('admin.cost.aquilineProfiles.permanentBadge')}</Badge>
            </S.FigureRow>
          </S.SummaryCard>
        </S.Grid>
      )}

      {activeTab === 'settings' && <AdminSettingsPanel skip={skip} />}

      {activeTab === 'billing' && (
        <S.Rows>
          <S.Section>
            <Text variant="caption" color="text.secondary">
              {t('admin.billing.costTotal')}
            </Text>
            <S.Grid>
              <S.SummaryCard>
                <Text variant="caption" color="text.secondary">
                  {t('admin.billing.costTotal')}
                </Text>
                <Text variant="metric" weight="semibold">
                  {formatCost(billingMetrics?.totalEstimatedCostMicros ?? null, billingMetrics?.currency ?? null)}
                </Text>
              </S.SummaryCard>
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">
              {t('admin.billing.accountStatus.title')}
            </Text>
            <S.Grid>
              {billingMetrics?.accountStatusDistribution.map((entry) => (
                <S.SummaryCard key={entry.status}>
                  <Text variant="body" weight="semibold">
                    {t(`admin.billing.accountStatus.${entry.status}`, { defaultValue: entry.status })}
                  </Text>
                  <Text variant="metric" weight="semibold">
                    {entry.count}
                  </Text>
                </S.SummaryCard>
              ))}
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">
              {t('admin.billing.accessTier.title')}
            </Text>
            <S.Grid>
              {billingMetrics?.accessTierDistribution.map((entry) => (
                <S.SummaryCard key={entry.tier}>
                  <Text variant="body" weight="semibold">
                    {t(`admin.billing.accessTier.${entry.tier}`, { defaultValue: entry.tier })}
                  </Text>
                  <Text variant="metric" weight="semibold">
                    {entry.count}
                  </Text>
                </S.SummaryCard>
              ))}
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">
              {t('admin.billing.quota.title')}
            </Text>
            <S.Rows>
              {billingMetrics?.quotaPressure.map((summary) => (
                <S.Row key={summary.resource}>
                  <Text variant="body" weight="semibold">
                    {t(`admin.billing.quota.${summary.resource}`)}
                  </Text>
                  <Text variant="body-sm" color="text.secondary">
                    {t('admin.billing.quota.summary', {
                      usersWithUsage: summary.usersWithUsage,
                      maxUsage: summary.maxUsage ?? '—',
                      warn: summary.warnThreshold,
                      critical: summary.criticalThreshold,
                    })}
                  </Text>
                </S.Row>
              ))}
            </S.Rows>
            <S.Rows>
              {billingMetrics?.quotaPressure.flatMap((summary) =>
                summary.bands.map((band) => (
                  <S.Row key={`${summary.resource}-${band.band}`}>
                    <Text variant="body-sm">
                      {t(`admin.billing.quota.${summary.resource}`)} · {t(`admin.billing.band.${band.band}`)}
                    </Text>
                    <Badge variant={BAND_VARIANT[band.band]}>{band.userCount}</Badge>
                  </S.Row>
                ))
              )}
            </S.Rows>
          </S.Section>
        </S.Rows>
      )}

      {activeTab === 'listingQuality' && (
        <S.Rows>
          <S.Grid>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.listingQuality.averageSpecifics')}
              </Text>
              <Text variant="metric" weight="semibold" numeric>
                {listingQuality.summary?.averageSpecifics ?? '—'}
              </Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.listingQuality.listingsAnalyzed', {
                  value: listingQuality.summary?.listingsAnalyzed ?? 0,
                })}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">
                {t('admin.listingQuality.autofilled')}
              </Text>
              <Text variant="metric" weight="semibold" numeric>
                {listingQuality.summary?.listingsWithAutofill ?? '—'}
              </Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.listingQuality.autofilledHint')}
              </Text>
            </S.SummaryCard>
          </S.Grid>

          <S.Section>
            <Text variant="h4" weight="semibold">
              {t('admin.listingQuality.coverage')}
            </Text>
            <S.Rows>
              {(listingQuality.summary?.coverage ?? []).slice(0, 12).map((row) => (
                <S.Row key={`${row.categoryId}-${row.layer}`}>
                  <Text variant="body-sm">
                    {row.categoryId || '—'} ·{' '}
                    {t(`admin.listingQuality.layer.${row.layer}`, { defaultValue: row.layer })}
                  </Text>
                  <Text variant="body-sm" numeric>
                    {row.aspectCount}
                  </Text>
                </S.Row>
              ))}
            </S.Rows>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">
              {t('admin.listingQuality.defaults')}
            </Text>
            <Text variant="caption" color="text.secondary">
              {t('admin.listingQuality.defaultsHint')}
            </Text>
            <SearchField
              value={listingQuality.search}
              onChange={(event) => listingQuality.onSearchChange(event.target.value)}
              placeholder={t('admin.listingQuality.searchPlaceholder')}
            />
            <S.Rows>
              {listingQuality.defaults.map((row) => (
                <S.Row key={row.id}>
                  <Text variant="body-sm">
                    {row.categoryId} · {row.aspectName} = {row.value}
                  </Text>
                  <S.RowActions>
                    <Badge variant={row.source === AspectDefaultSourceDto.CURATED ? 'info' : 'neutral'}>
                      {t(`admin.listingQuality.source.${row.source}`)}
                    </Badge>
                    <Text variant="caption" color="text.secondary" numeric>
                      {row.successCount}
                    </Text>
                    <Button
                      size="small"
                      variant="secondary"
                      isLoading={listingQuality.isRemoving}
                      onClick={() => listingQuality.onRemoveDefault(row.id)}
                    >
                      <Text variant="body-sm">{t('admin.listingQuality.remove')}</Text>
                    </Button>
                  </S.RowActions>
                </S.Row>
              ))}
            </S.Rows>
          </S.Section>
        </S.Rows>
      )}

      {activeTab === 'users' && (
        <S.Rows>
          {/* Listings / orders / Keepa / LLM used to be interpolated into a
              single sentence per row, so none of them could be scanned down
              a column or sorted. Each is its own numeric column now. */}
          <Table
            columns={userColumns}
            data={usersList?.users ?? []}
            emptyContent={
              <EmptyState
                icon="user"
                title={t('admin.users.empty')}
                description={t('admin.users.emptyDescription')}
                size="md"
              />
            }
          />
          <Text variant="caption" color="text.secondary">
            {t('admin.overview.roleCliNotice')}
          </Text>
        </S.Rows>
      )}

      {activeTab === 'ebayLimits' && (
        <S.Rows>
          {/* eBay meters calls per APPLICATION, so this pool is shared by every
              seller: running a resource dry stops that operation platform-wide,
              not for one customer. Background work is additionally capped below
              the ceiling so a seller's own action always has budget left. The
              ceilings themselves come from eBay's own `getRateLimits` — never a
              typed-in default — so this tab shows eBay's figure beside ours. */}
          <Text variant="caption" color="text.secondary">
            {t('admin.ebayLimits.description')}
          </Text>
          {ebayFigureMissing ? (
            <InfoMessage type="info">{t('admin.ebayLimits.figuresMissing')}</InfoMessage>
          ) : (
            <>
              <Text variant="caption" color="text.secondary">
                {ebayFigureNote}
              </Text>
              {ebayFigureStale && (
                <InfoMessage type="warning">{t('admin.ebayLimits.figuresStale')}</InfoMessage>
              )}
            </>
          )}
          <Text variant="caption" color="text.secondary">
            {t('admin.ebayLimits.compareHint')}
          </Text>
          <Table
            columns={budgetColumns}
            data={ebayBudgetRows}
            emptyContent={
              <EmptyState
                icon="gauge"
                title={t('admin.ebayLimits.empty')}
                description={t('admin.ebayLimits.emptyDescription')}
                size="md"
              />
            }
          />
          <Text variant="h5">{t('admin.ebayLimits.unmappedTitle')}</Text>
          <Text variant="caption" color="text.secondary">
            {t('admin.ebayLimits.unmappedDescription')}
          </Text>
          {ebayUnmapped.length > 0 && <Table columns={unmappedColumns} data={ebayUnmapped} />}
        </S.Rows>
      )}

      {activeTab === 'listingFailures' && (
        <S.Rows>
          {/* The provider's raw wording lives here and nowhere else: sellers get
              the localized reason, because eBay's own text names internal
              fields and reads as a defect in their product. */}
          <Text variant="caption" color="text.secondary">
            {t('admin.listingFailures.description')}
          </Text>
          <Table
            columns={failureColumns}
            data={listingFailures?.items ?? []}
            emptyContent={
              <EmptyState
                icon="check-circle"
                title={t('admin.listingFailures.empty')}
                description={t('admin.listingFailures.emptyDescription')}
                size="md"
              />
            }
          />
        </S.Rows>
      )}
    </S.Container>
  );
};
