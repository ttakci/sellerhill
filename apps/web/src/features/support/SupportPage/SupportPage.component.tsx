import { SupportQueueFilter } from '@repo/shared';
import { Button, EmptyState, Icon, PageHeader, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './SupportPage.style';
import type { SupportPageComponentProps } from './SupportPage.types';

const FILTERS = [SupportQueueFilter.WAITING, SupportQueueFilter.ASSIGNED_TO_ME, SupportQueueFilter.OPEN, SupportQueueFilter.RESOLVED, SupportQueueFilter.ALL] as const;

export const SupportPageComponent = ({ filter, isLoading, items, onFilterChange, onOpenConversation }: SupportPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <S.Container>
      <PageHeader title={t('translation:support.title')} subtitle={t('translation:support.subtitle')} />
      <S.FilterRow>
        {FILTERS.map((option) => <Button key={option} variant={option === filter ? 'primary' : 'secondary'} size="small" onClick={() => onFilterChange(option)}><Text variant="body-sm">{t(`translation:support.filters.${option}`)}</Text></Button>)}
      </S.FilterRow>
      {isLoading ? <Text variant="body-sm" color="text.secondary">{t('translation:support.loading')}</Text> : null}
      {!isLoading && items.length === 0 ? <EmptyState icon="inbox" title={t('translation:support.emptyTitle')} description={t('translation:support.emptyDescription')} /> : null}
      <S.List>
        {items.map((item) => (
          <S.ConversationButton key={item.id} variant="secondary" onClick={() => onOpenConversation(item.id)}>
            <S.ConversationText><Text variant="body" weight="semibold">{item.title}</Text><Text variant="body-sm" color="text.secondary">{item.customerDisplayName}</Text></S.ConversationText>
            <Icon name="arrow-right" size={16} />
          </S.ConversationButton>
        ))}
      </S.List>
    </S.Container>
  );
};
