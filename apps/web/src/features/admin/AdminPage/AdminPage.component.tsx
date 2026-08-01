import {
  AdminWarningLevel,
  AspectDefaultSourceDto,
  PlatformSettingCategory,
  PlatformSettingSource,
  PlatformSettingType,
  QuotaPressureBand,
} from '@repo/shared';
import {
  Badge,
  Button,
  EmptyState,
  ModernTextInput,
  PageHeader,
  SearchField,
  TabNav,
  Table,
  Text,
  Toggle,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AdminPage.style';
import type { AdminPageComponentProps, AdminTabId } from './AdminPage.types';

const TABS: AdminTabId[] = [
  'overview',
  'queues',
  'costs',
  'proxies',
  'listingQuality',
  'settings',
  'billing',
  'users',
];

/** Badge variant for a quota pressure band. */
const BAND_VARIANT: Record<QuotaPressureBand, 'neutral' | 'success' | 'warning' | 'error'> = {
  [QuotaPressureBand.NONE]: 'neutral',
  [QuotaPressureBand.UNDER_LIMIT]: 'success',
  [QuotaPressureBand.NEAR_LIMIT]: 'warning',
  [QuotaPressureBand.AT_LIMIT]: 'error',
  [QuotaPressureBand.OVER_LIMIT]: 'error',
};

/** A database override is the only source worth calling out visually. */
const SOURCE_VARIANT: Record<PlatformSettingSource, 'neutral' | 'success' | 'warning' | 'error'> = {
  [PlatformSettingSource.DATABASE]: 'success',
  [PlatformSettingSource.ENV]: 'neutral',
  [PlatformSettingSource.DEFAULT]: 'neutral',
};

export const AdminPageComponent = ({
  activeTab,
  listingQuality,
  overview,
  operations,
  providerCosts,
  billingMetrics,
  proxyPool,
  usersList,
  userColumns,
  proxyColumns,
  settingGroups,
  settingDrafts,
  isSavingSetting,
  emailTestResult,
  isTestingEmail,
  proxyForm,
  isSavingProxy,
  onTabChange,
  onProxyFieldChange,
  onProxySubmit,
  onSettingDraftChange,
  onSettingSave,
  onSettingToggle,
  onSettingReset,
  onEmailTest,
  formatCost,
}: AdminPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['admin', 'translation']);
  return (
    <S.Container>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      {/* Section navigation, not a call to action. These were `Button`s whose
          active one was `variant="primary"`, so the loudest thing on the page
          was always "where you already are". */}
      <TabNav
        items={TABS.map((tab) => ({ id: tab, label: t(`admin.tabs.${tab}`) }))}
        value={activeTab}
        onChange={(id) => onTabChange(id as AdminTabId)}
        ariaLabel={t('admin.title')}
      />

      {activeTab === 'overview' && (
        <S.Rows>
          <S.Grid>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.overview.users')}</Text>
              <Text variant="metric" weight="semibold">{overview?.totalUsers ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.overview.activeListings')}</Text>
              <Text variant="metric" weight="semibold">{overview?.activeListings ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.overview.orders')}</Text>
              <Text variant="metric" weight="semibold">{overview?.ordersLast30Days ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.overview.ebayStores')}</Text>
              <Text variant="metric" weight="semibold">{overview?.activeEbayStores ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.overview.amazonAccounts')}</Text>
              <Text variant="metric" weight="semibold">{overview?.activeAmazonAccounts ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.overview.keepaBalance')}</Text>
              <Text variant="metric" weight="semibold">{operations?.keepaTokensLeft ?? '—'}</Text>
            </S.SummaryCard>
          </S.Grid>

          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.overview.warningsTitle')}</Text>
            {operations && operations.warnings.length === 0 && (
              <Text variant="body-sm" color="text.secondary">{t('admin.overview.noWarnings')}</Text>
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
              <Text variant="body" weight="semibold">{queue.name}</Text>
              <Text variant="body-sm" color="text.secondary">
                {t('admin.queue.summary', { waiting: queue.waiting, active: queue.active, failed: queue.failedObserved })}
              </Text>
            </S.Row>
          ))}
        </S.Rows>
      )}

      {activeTab === 'costs' && (
        <S.Grid>
          <S.SummaryCard>
            <Text variant="caption" color="text.secondary">{t('admin.cost.proxyPool')}</Text>
            <Text variant="metric" weight="semibold">
              {proxyPool
                ? formatCost(proxyPool.summary.totalMonthlyCostMicros, proxyPool.summary.currency)
                : '—'}
            </Text>
            <Text variant="caption" color="text.secondary">{t('admin.cost.proxyPoolHint')}</Text>
          </S.SummaryCard>
          {providerCosts.map((cost) => (
            <S.SummaryCard key={`${cost.source}-${cost.metric}`}>
              <Text variant="body" weight="semibold">{t(`admin.metrics.${cost.metric}`)}</Text>
              <Text variant="metric-sm" weight="semibold">{formatCost(cost.totalCostMicros, cost.currency)}</Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.cost.quantity', { quantity: cost.totalQuantity })}
              </Text>
            </S.SummaryCard>
          ))}
        </S.Grid>
      )}

      {activeTab === 'proxies' && (
        <S.Rows>
          <S.Grid>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.proxies.activePool')}</Text>
              <Text variant="metric" weight="semibold">{proxyPool?.summary.activeProxies ?? '—'}</Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.proxies.freeCount', { value: proxyPool?.summary.freeActiveProxies ?? 0 })}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.proxies.assigned')}</Text>
              <Text variant="metric" weight="semibold">{proxyPool?.summary.assignedProxies ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.proxies.monthlyCost')}</Text>
              <Text variant="metric" weight="semibold">
                {proxyPool
                  ? formatCost(proxyPool.summary.totalMonthlyCostMicros, proxyPool.summary.currency)
                  : '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="caption" color="text.secondary">{t('admin.proxies.expiringSoon')}</Text>
              <Text variant="metric" weight="semibold">{proxyPool?.summary.expiringSoon ?? '—'}</Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.proxies.expiredCount', { value: proxyPool?.summary.expired ?? 0 })}
              </Text>
            </S.SummaryCard>
          </S.Grid>

          <S.Section>
            <Text variant="caption" color="text.secondary">{t('admin.proxies.addTitle')}</Text>
            <Text variant="body-sm" color="text.secondary">{t('admin.proxies.addSubtitle')}</Text>
            <S.FormGrid>
              <ModernTextInput
                name="proxyHost"
                label={t('admin.proxies.host')}
                value={proxyForm.host}
                onChange={(e) => onProxyFieldChange('host', e.target.value)}
              />
              <ModernTextInput
                name="proxyPort"
                type="number"
                label={t('admin.proxies.port')}
                value={proxyForm.port}
                onChange={(e) => onProxyFieldChange('port', e.target.value)}
              />
              <ModernTextInput
                name="proxyUsername"
                label={t('admin.proxies.username')}
                value={proxyForm.username}
                onChange={(e) => onProxyFieldChange('username', e.target.value)}
              />
              <ModernTextInput
                name="proxyPassword"
                type="password"
                label={t('admin.proxies.password')}
                value={proxyForm.password}
                onChange={(e) => onProxyFieldChange('password', e.target.value)}
              />
              <ModernTextInput
                name="proxyLabel"
                label={t('admin.proxies.labelField')}
                value={proxyForm.label}
                onChange={(e) => onProxyFieldChange('label', e.target.value)}
              />
              <ModernTextInput
                name="proxyExpiresAt"
                type="date"
                label={t('admin.proxies.expiresAt')}
                value={proxyForm.expiresAt}
                onChange={(e) => onProxyFieldChange('expiresAt', e.target.value)}
              />
              <ModernTextInput
                name="proxyMonthlyCost"
                type="number"
                label={t('admin.proxies.monthlyCostUsd')}
                value={proxyForm.monthlyCostUsd}
                onChange={(e) => onProxyFieldChange('monthlyCostUsd', e.target.value)}
              />
            </S.FormGrid>
            <S.FormActions>
              <Button variant="primary" onClick={onProxySubmit} isLoading={isSavingProxy} disabled={isSavingProxy}>
                <Text variant="body-sm" weight="semibold">{t('admin.proxies.addButton')}</Text>
              </Button>
            </S.FormActions>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.proxies.listTitle')}</Text>
            {/* Was a hand-built flex row per proxy that ran label, assignee,
                expiry and cost together into two sentences. */}
            <Table
              columns={proxyColumns}
              data={proxyPool?.proxies ?? []}
              emptyContent={
                <EmptyState
                  icon="server"
                  title={t('admin.proxies.empty')}
                  description={t('admin.proxies.emptyDescription')}
                  size="md"
                />
              }
            />
          </S.Section>
        </S.Rows>
      )}

      {activeTab === 'settings' && (
        <S.Rows>
          <Text variant="body-sm" color="text.secondary">{t('admin.settings.intro')}</Text>
          {settingGroups.map((group) => (
            <S.Section key={group.category}>
              <Text variant="h4" weight="semibold">{t(`admin.settings.category.${group.category}`)}</Text>
              {group.category === PlatformSettingCategory.EMAIL && (
                <S.FormActions>
                  {emailTestResult && (
                    <Badge variant={emailTestResult.ok ? 'success' : 'error'}>
                      {emailTestResult.ok ? t('admin.settings.emailTestOk') : t('admin.settings.emailTestFailed')}
                    </Badge>
                  )}
                  <Button variant="secondary" size="small" onClick={onEmailTest} isLoading={isTestingEmail} disabled={isTestingEmail}>
                    <Text variant="body-sm" weight="semibold">{t('admin.settings.emailTest')}</Text>
                  </Button>
                </S.FormActions>
              )}
              <S.Rows>
                {group.settings.map((setting) => (
                  <S.Row key={setting.key}>
                    <S.RowMain>
                      <Text variant="body" weight="semibold">
                        {t(`admin.settings.keys.${setting.key}`, { defaultValue: setting.key })}
                      </Text>
                      <Text variant="caption" color="text.secondary">
                        {t('admin.settings.envHint', { envVar: setting.envVar })}
                        {setting.defaultValue !== null
                          ? ` · ${t('admin.settings.defaultHint', { value: setting.defaultValue })}`
                          : ''}
                      </Text>
                      <S.RowSide>
                        <Badge variant={SOURCE_VARIANT[setting.source]}>
                          {t(`admin.settings.source.${setting.source}`)}
                        </Badge>
                        {setting.requiresRestart && (
                          <Badge variant="warning">{t('admin.settings.requiresRestart')}</Badge>
                        )}
                        {setting.isSecret && (
                          <Badge variant={setting.hasValue ? 'success' : 'neutral'}>
                            {setting.hasValue
                              ? t('admin.settings.secretSet')
                              : t('admin.settings.secretUnset')}
                          </Badge>
                        )}
                      </S.RowSide>
                    </S.RowMain>
                    <S.RowSide>
                      {setting.type === PlatformSettingType.BOOLEAN ? (
                        <Toggle
                          checked={setting.value === 'true'}
                          onChange={() => onSettingToggle(setting)}
                          disabled={isSavingSetting}
                        />
                      ) : (
                        <>
                          <S.SettingInput>
                            <ModernTextInput
                              name={setting.key}
                              type={
                                setting.isSecret
                                  ? 'password'
                                  : setting.type === PlatformSettingType.NUMBER
                                    ? 'number'
                                    : 'text'
                              }
                              label={t('admin.settings.valueLabel')}
                              value={settingDrafts[setting.key] ?? (setting.isSecret ? '' : setting.value ?? '')}
                              onChange={(e) => onSettingDraftChange(setting.key, e.target.value)}
                            />
                          </S.SettingInput>
                          <Button
                            variant="primary"
                            size="small"
                            onClick={() => onSettingSave(setting.key)}
                            disabled={isSavingSetting || settingDrafts[setting.key] === undefined}
                          >
                            <Text variant="body-sm" weight="semibold">{t('translation:common.save')}</Text>
                          </Button>
                        </>
                      )}
                      {setting.source === PlatformSettingSource.DATABASE && (
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => onSettingReset(setting.key)}
                          disabled={isSavingSetting}
                        >
                          <Text variant="body-sm" weight="semibold">{t('admin.settings.reset')}</Text>
                        </Button>
                      )}
                    </S.RowSide>
                  </S.Row>
                ))}
              </S.Rows>
            </S.Section>
          ))}
        </S.Rows>
      )}

      {activeTab === 'billing' && (
        <S.Rows>
          <S.Section>
            <Text variant="caption" color="text.secondary">{t('admin.billing.costTotal')}</Text>
            <S.Grid>
              <S.SummaryCard>
                <Text variant="caption" color="text.secondary">{t('admin.billing.costTotal')}</Text>
                <Text variant="metric" weight="semibold">
                  {formatCost(billingMetrics?.totalEstimatedCostMicros ?? null, billingMetrics?.currency ?? null)}
                </Text>
              </S.SummaryCard>
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.billing.accountStatus.title')}</Text>
            <S.Grid>
              {billingMetrics?.accountStatusDistribution.map((entry) => (
                <S.SummaryCard key={entry.status}>
                  <Text variant="body" weight="semibold">{t(`admin.billing.accountStatus.${entry.status}`, { defaultValue: entry.status })}</Text>
                  <Text variant="metric" weight="semibold">{entry.count}</Text>
                </S.SummaryCard>
              ))}
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.billing.accessTier.title')}</Text>
            <S.Grid>
              {billingMetrics?.accessTierDistribution.map((entry) => (
                <S.SummaryCard key={entry.tier}>
                  <Text variant="body" weight="semibold">{t(`admin.billing.accessTier.${entry.tier}`, { defaultValue: entry.tier })}</Text>
                  <Text variant="metric" weight="semibold">{entry.count}</Text>
                </S.SummaryCard>
              ))}
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.billing.quota.title')}</Text>
            <S.Rows>
              {billingMetrics?.quotaPressure.map((summary) => (
                <S.Row key={summary.resource}>
                  <Text variant="body" weight="semibold">{t(`admin.billing.quota.${summary.resource}`)}</Text>
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
                )),
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
                    {row.categoryId || '—'} · {t(`admin.listingQuality.layer.${row.layer}`, { defaultValue: row.layer })}
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
          <Text variant="caption" color="text.secondary">{t('admin.overview.roleCliNotice')}</Text>
        </S.Rows>
      )}
    </S.Container>
  );
};
