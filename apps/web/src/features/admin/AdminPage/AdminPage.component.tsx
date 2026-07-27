import { Badge, Button, PageHeader, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AdminPage.style';
import type { AdminPageComponentProps, AdminTabId } from './AdminPage.types';

const TABS: AdminTabId[] = ['queues', 'costs', 'users'];

export const AdminPageComponent = ({
  activeTab,
  overview,
  operations,
  providerCosts,
  userCosts,
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
              <Badge variant={warning.level === 'critical' ? 'error' : 'warning'}>{warning.value}</Badge>
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
