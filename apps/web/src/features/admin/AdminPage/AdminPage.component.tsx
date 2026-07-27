import { AdminWarningLevel, QuotaPressureBand } from '@repo/shared';
import { Badge, Button, PageHeader, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AdminPage.style';
import type { AdminPageComponentProps, AdminTabId } from './AdminPage.types';

const TABS: AdminTabId[] = ['queues', 'costs', 'billing', 'users'];

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
  overview,
  operations,
  providerCosts,
  userCosts,
  billingMetrics,
  onTabChange,
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
          {providerCosts.map((cost) => (
            <S.SummaryCard key={`${cost.source}-${cost.metric}`}>
              <Text variant="body" weight="semibold">{t(`admin.metrics.${cost.metric}`)}</Text>
              <Text variant="h4">{cost.totalCostMicros === null ? '—' : cost.totalCostMicros}</Text>
            </S.SummaryCard>
          ))}
        </S.Grid>
      )}

      {activeTab === 'billing' && (
        <S.Rows>
          <S.Section>
            <Text variant="h4" weight="semibold">{t('admin.billing.costTotal')}</Text>
            <S.Grid>
              <S.SummaryCard>
                <Text variant="body" weight="semibold">{t('admin.billing.costTotal')}</Text>
                <Text variant="h3">{billingMetrics?.totalEstimatedCostMicros ?? '—'}</Text>
                {billingMetrics?.currency && (
                  <Text variant="caption" color="text.secondary">{billingMetrics.currency}</Text>
                )}
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
          {userCosts.map((cost) => (
            <S.Row key={cost.userId ?? 'unattributed'}>
              <Text variant="body-sm">{cost.userId ?? t('admin.users.unattributed')}</Text>
              <Text variant="body-sm" weight="semibold">{cost.totalCostMicros ?? '—'}</Text>
            </S.Row>
          ))}
        </S.Rows>
      )}
    </S.Container>
  );
};
