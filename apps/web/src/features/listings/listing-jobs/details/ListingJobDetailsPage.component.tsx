import { Icon, Table } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ListingJobDetailsPage.style';
import type { ListingJobDetailsPageComponentProps } from './ListingJobDetailsPage.types';

export const ListingJobDetailsPageComponent: React.FC<ListingJobDetailsPageComponentProps> = ({
  jobId,
  items,
  isLoading,
  onRefresh,
  onBack,
  columns,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <S.Container>
      <S.Header>
        <S.TitleSection>
          <S.BackButton onClick={onBack}>
            <Icon name="arrow_back" size={20} />
            {t('translation:common.back')}
          </S.BackButton>
          <S.Title>
            {t('listings.jobs.details.title')}
            <small>({jobId})</small>
          </S.Title>
        </S.TitleSection>
        <S.Actions>
          <S.RefreshButton onClick={onRefresh} disabled={isLoading}>
            <Icon name="sync" size={20} />
            {t('translation:common.actions.refresh')}
          </S.RefreshButton>
        </S.Actions>
      </S.Header>

      <Table columns={columns} data={items} emptyMessage={t('listings.jobs.items.empty')} />
    </S.Container>
  );
};
