import { SupportQueueFilter } from '@repo/shared';
import { EmptyState, Icon, PageHeader, TabNav, Text } from '@repo/ui';
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
      {/* Queue sections, not actions — these were Buttons whose active one was
          `variant="primary"`, competing with the real CTAs on the page. */}
      <TabNav
        items={FILTERS.map((option) => ({
          id: option,
          label: t(`translation:support.filters.${option}`),
        }))}
        value={filter}
        onChange={(id) => onFilterChange(id as SupportQueueFilter)}
        ariaLabel={t('translation:support.title')}
      />
      {/* Loading used to be one line of grey text while empty was a full
          EmptyState card, so the two states looked like different screens. */}
      {isLoading ? (
        <EmptyState
          icon="inbox"
          title={t('translation:support.loading')}
          description={t('translation:support.loadingDescription')}
        />
      ) : null}
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
