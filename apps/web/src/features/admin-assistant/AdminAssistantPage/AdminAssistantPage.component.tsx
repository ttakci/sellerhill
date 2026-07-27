import { PageHeader, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AdminAssistantPage.style';
import type { AdminAssistantPageComponentProps } from './AdminAssistantPage.types';

export const AdminAssistantPageComponent = ({ isLoading, overview, queues, usage }: AdminAssistantPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <S.Container>
      <PageHeader title={t('translation:adminAssistant.title')} subtitle={t('translation:adminAssistant.subtitle')} />
      {isLoading ? <Text variant="body-sm" color="text.secondary">{t('translation:adminAssistant.loading')}</Text> : null}
      {overview ? (
        <S.Grid>
          <S.MetricCard><Text variant="h4" weight="semibold">{t('translation:adminAssistant.users')}</Text><Text variant="h2">{overview.totalUsers}</Text></S.MetricCard>
          <S.MetricCard><Text variant="h4" weight="semibold">{t('translation:adminAssistant.activeListings')}</Text><Text variant="h2">{overview.activeListings}</Text></S.MetricCard>
          <S.MetricCard><Text variant="h4" weight="semibold">{t('translation:adminAssistant.orders')}</Text><Text variant="h2">{overview.ordersLast30Days}</Text></S.MetricCard>
        </S.Grid>
      ) : null}
      <Text variant="h3" weight="semibold">{t('translation:adminAssistant.queues')}</Text>
      <S.List>{queues.map((queue) => <S.Row key={queue.name}><Text variant="body" weight="semibold">{queue.name}</Text><Text variant="body-sm">{queue.waiting + queue.active}</Text></S.Row>)}</S.List>
      <Text variant="h3" weight="semibold">{t('translation:adminAssistant.usage')}</Text>
      <S.List>{usage.map((item) => <S.Row key={`${item.source}-${item.metric}`}><Text variant="body" weight="semibold">{item.metric}</Text><Text variant="body-sm">{item.totalQuantity}</Text></S.Row>)}</S.List>
      <Text variant="body-sm" color="text.secondary">{t('translation:adminAssistant.roleCliNotice')}</Text>
    </S.Container>
  );
};
