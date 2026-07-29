import {
  AdminWarningLevel,
  PlatformSettingCategory,
  PlatformSettingSource,
  PlatformSettingType,
  ProxyExpiryState,
  ProxyStatus,
  QuotaPressureBand,
  UserStatus,
} from '@repo/shared';
import { Badge, Button, ModernTextInput, PageHeader, Text, Toggle } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AdminPage.style';
import type { AdminPageComponentProps, AdminTabId } from './AdminPage.types';

const TABS: AdminTabId[] = ['overview', 'queues', 'costs', 'proxies', 'settings', 'billing', 'users'];

/** Badge variant for a quota pressure band. */
const BAND_VARIANT: Record<QuotaPressureBand, 'neutral' | 'success' | 'warning' | 'error'> = {
  [QuotaPressureBand.NONE]: 'neutral',
  [QuotaPressureBand.UNDER_LIMIT]: 'success',
  [QuotaPressureBand.NEAR_LIMIT]: 'warning',
  [QuotaPressureBand.AT_LIMIT]: 'error',
  [QuotaPressureBand.OVER_LIMIT]: 'error',
};

/** Badge variant for a proxy's server-derived expiry state. */
const EXPIRY_VARIANT: Record<ProxyExpiryState, 'neutral' | 'success' | 'warning' | 'error'> = {
  [ProxyExpiryState.NO_EXPIRY]: 'neutral',
  [ProxyExpiryState.OK]: 'success',
  [ProxyExpiryState.EXPIRING_SOON]: 'warning',
  [ProxyExpiryState.EXPIRED]: 'error',
};

/** A database override is the only source worth calling out visually. */
const SOURCE_VARIANT: Record<PlatformSettingSource, 'neutral' | 'success' | 'warning' | 'error'> = {
  [PlatformSettingSource.DATABASE]: 'success',
  [PlatformSettingSource.ENV]: 'neutral',
  [PlatformSettingSource.DEFAULT]: 'neutral',
};

export const AdminPageComponent = ({
  activeTab,
  overview,
  operations,
  providerCosts,
  billingMetrics,
  proxyPool,
  usersList,
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
  onProxyToggleStatus,
  onSettingDraftChange,
  onSettingSave,
  onSettingToggle,
  onSettingReset,
  onEmailTest,
  formatCost,
  formatDateValue,
}: AdminPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['admin', 'translation']);
  return (
    <S.Container>
      <PageHeader title={t('admin.title')} subtitle={t('admin.subtitle')} />
      <S.Tabs role="tablist">
        {TABS.map((tab) => (
          <Button key={tab} variant={activeTab === tab ? 'primary' : 'secondary'} onClick={() => onTabChange(tab)}>
            <Text variant="body-sm" weight="semibold">{t(`admin.tabs.${tab}`)}</Text>
          </Button>
        ))}
      </S.Tabs>

      {activeTab === 'overview' && (
        <S.Rows>
          <S.Grid>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.overview.users')}</Text>
              <Text variant="h3">{overview?.totalUsers ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.overview.activeListings')}</Text>
              <Text variant="h3">{overview?.activeListings ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.overview.orders')}</Text>
              <Text variant="h3">{overview?.ordersLast30Days ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.overview.ebayStores')}</Text>
              <Text variant="h3">{overview?.activeEbayStores ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.overview.amazonAccounts')}</Text>
              <Text variant="h3">{overview?.activeAmazonAccounts ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.overview.keepaBalance')}</Text>
              <Text variant="h3">{operations?.keepaTokensLeft ?? '—'}</Text>
            </S.SummaryCard>
          </S.Grid>

          <S.Section>
            <Text variant="h5" weight="semibold">{t('admin.overview.warningsTitle')}</Text>
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

          <Text variant="caption" color="text.secondary">{t('admin.overview.roleCliNotice')}</Text>
        </S.Rows>
      )}

      {activeTab === 'queues' && (
        <S.Rows>
          {operations?.warnings.map((warning, index) => (
            <S.Row key={`${warning.kind}-${warning.subject ?? index}`}>
              <Text variant="body-sm">{t(`admin.warnings.${warning.kind}`, { subject: warning.subject })}</Text>
              <Badge variant={warning.level === AdminWarningLevel.CRITICAL ? 'error' : 'warning'}>{warning.value}</Badge>
            </S.Row>
          ))}
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
            <Text variant="h4" weight="semibold">{t('admin.cost.keepaBalance')}</Text>
            <Text variant="h3">{operations?.keepaTokensLeft ?? '—'}</Text>
          </S.SummaryCard>
          <S.SummaryCard>
            <Text variant="h4" weight="semibold">{t('admin.cost.users')}</Text>
            <Text variant="h3">{overview?.totalUsers ?? '—'}</Text>
          </S.SummaryCard>
          <S.SummaryCard>
            <Text variant="h4" weight="semibold">{t('admin.cost.proxyPool')}</Text>
            <Text variant="h3">
              {proxyPool
                ? formatCost(proxyPool.summary.totalMonthlyCostMicros, proxyPool.summary.currency)
                : '—'}
            </Text>
            <Text variant="caption" color="text.secondary">{t('admin.cost.proxyPoolHint')}</Text>
          </S.SummaryCard>
          {providerCosts.map((cost) => (
            <S.SummaryCard key={`${cost.source}-${cost.metric}`}>
              <Text variant="body" weight="semibold">{t(`admin.metrics.${cost.metric}`)}</Text>
              <Text variant="h4">{formatCost(cost.totalCostMicros, cost.currency)}</Text>
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
              <Text variant="body" weight="semibold">{t('admin.proxies.activePool')}</Text>
              <Text variant="h3">{proxyPool?.summary.activeProxies ?? '—'}</Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.proxies.freeCount', { value: proxyPool?.summary.freeActiveProxies ?? 0 })}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.proxies.assigned')}</Text>
              <Text variant="h3">{proxyPool?.summary.assignedProxies ?? '—'}</Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.proxies.monthlyCost')}</Text>
              <Text variant="h3">
                {proxyPool
                  ? formatCost(proxyPool.summary.totalMonthlyCostMicros, proxyPool.summary.currency)
                  : '—'}
              </Text>
            </S.SummaryCard>
            <S.SummaryCard>
              <Text variant="body" weight="semibold">{t('admin.proxies.expiringSoon')}</Text>
              <Text variant="h3">{proxyPool?.summary.expiringSoon ?? '—'}</Text>
              <Text variant="caption" color="text.secondary">
                {t('admin.proxies.expiredCount', { value: proxyPool?.summary.expired ?? 0 })}
              </Text>
            </S.SummaryCard>
          </S.Grid>

          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.proxies.addTitle')}</Text>
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
            {proxyPool && proxyPool.proxies.length === 0 && (
              <Text variant="body-sm" color="text.secondary">{t('admin.proxies.empty')}</Text>
            )}
            <S.Rows>
              {proxyPool?.proxies.map((proxy) => (
                <S.Row key={proxy.id}>
                  <S.RowMain>
                    <Text variant="body" weight="semibold">{`${proxy.host}:${proxy.port}`}</Text>
                    <Text variant="body-sm" color="text.secondary">
                      {proxy.label ?? '—'}
                      {' · '}
                      {proxy.assignedUserEmail ?? t('admin.proxies.unassigned')}
                    </Text>
                    <Text variant="caption" color="text.secondary">
                      {proxy.expiresAt
                        ? t('admin.proxies.expiresOn', { date: formatDateValue(proxy.expiresAt) })
                        : t('admin.proxies.noExpiry')}
                      {' · '}
                      {formatCost(proxy.monthlyCostMicros, proxy.currency)}
                    </Text>
                  </S.RowMain>
                  <S.RowSide>
                    <Badge variant={proxy.status === ProxyStatus.ACTIVE ? 'success' : 'neutral'}>
                      {t(`admin.proxies.status.${proxy.status}`)}
                    </Badge>
                    {proxy.expiryState !== ProxyExpiryState.NO_EXPIRY && (
                      <Badge variant={EXPIRY_VARIANT[proxy.expiryState]}>
                        {t(`admin.proxies.expiry.${proxy.expiryState}`, { value: proxy.daysUntilExpiry ?? 0 })}
                      </Badge>
                    )}
                    <Button variant="secondary" size="small" onClick={() => onProxyToggleStatus(proxy)} disabled={isSavingProxy}>
                      <Text variant="body-sm" weight="semibold">
                        {proxy.status === ProxyStatus.ACTIVE
                          ? t('admin.proxies.disable')
                          : t('admin.proxies.enable')}
                      </Text>
                    </Button>
                  </S.RowSide>
                </S.Row>
              ))}
            </S.Rows>
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
            <Text variant="h4" weight="semibold">{t('admin.billing.costTotal')}</Text>
            <S.Grid>
              <S.SummaryCard>
                <Text variant="body" weight="semibold">{t('admin.billing.costTotal')}</Text>
                <Text variant="h3">
                  {formatCost(billingMetrics?.totalEstimatedCostMicros ?? null, billingMetrics?.currency ?? null)}
                </Text>
              </S.SummaryCard>
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h5" weight="semibold">{t('admin.billing.accountStatus.title')}</Text>
            <S.Grid>
              {billingMetrics?.accountStatusDistribution.map((entry) => (
                <S.SummaryCard key={entry.status}>
                  <Text variant="body" weight="semibold">{t(`admin.billing.accountStatus.${entry.status}`, { defaultValue: entry.status })}</Text>
                  <Text variant="h3">{entry.count}</Text>
                </S.SummaryCard>
              ))}
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h5" weight="semibold">{t('admin.billing.accessTier.title')}</Text>
            <S.Grid>
              {billingMetrics?.accessTierDistribution.map((entry) => (
                <S.SummaryCard key={entry.tier}>
                  <Text variant="body" weight="semibold">{t(`admin.billing.accessTier.${entry.tier}`, { defaultValue: entry.tier })}</Text>
                  <Text variant="h3">{entry.count}</Text>
                </S.SummaryCard>
              ))}
            </S.Grid>
          </S.Section>

          <S.Section>
            <Text variant="h5" weight="semibold">{t('admin.billing.quota.title')}</Text>
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

      {activeTab === 'users' && (
        <S.Rows>
          {usersList && (
            <Text variant="body-sm" color="text.secondary">
              {t('admin.users.total', { value: usersList.users.length })}
            </Text>
          )}
          {usersList?.users.map((row) => (
            <S.Row key={row.id}>
              <S.RowMain>
                <Text variant="body" weight="semibold">{row.email}</Text>
                <Text variant="body-sm" color="text.secondary">
                  {t('admin.users.stats', {
                    listings: row.activeListings,
                    orders: row.ordersLast30Days,
                    keepa: row.keepaTokens,
                    llm: row.llmTokens,
                  })}
                </Text>
                <Text variant="caption" color="text.secondary">
                  {row.proxyHost
                    ? t('admin.users.proxy', { proxy: row.proxyHost })
                    : t('admin.users.noProxy')}
                </Text>
              </S.RowMain>
              <S.RowSide>
                <Badge variant="neutral">{t(`admin.billing.accessTier.${row.role}`, { defaultValue: row.role })}</Badge>
                <Badge variant={row.status === UserStatus.ACTIVE ? 'success' : 'warning'}>
                  {t(`admin.billing.accountStatus.${row.status}`, { defaultValue: row.status })}
                </Badge>
                <Text variant="body" weight="semibold">
                  {formatCost(row.estimatedCostMicros, row.currency)}
                </Text>
              </S.RowSide>
            </S.Row>
          ))}
          <Text variant="caption" color="text.secondary">{t('admin.overview.roleCliNotice')}</Text>
        </S.Rows>
      )}
    </S.Container>
  );
};
