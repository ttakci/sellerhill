import { Icon, Table } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import * as S from './ListingJobsPage.style';
import type { ListingJobsPageComponentProps } from './ListingJobsPage.types';

export const ListingJobsPageComponent: React.FC<ListingJobsPageComponentProps> = ({
  jobs,
  isLoading,
  onRefresh,
  pagination,
  columns,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  return (
    <S.Container>
      <S.Header>
        <S.TitleSection>
          <h1>{t('listings.jobs.title')}</h1>
          <p>{t('listings.jobs.subtitle')}</p>
        </S.TitleSection>
        <S.Actions>
          <S.RefreshButton onClick={onRefresh} disabled={isLoading}>
            <Icon name="sync" size={20} />
            {t('translation:common.actions.refresh')}
          </S.RefreshButton>
        </S.Actions>
      </S.Header>

      <Table columns={columns} data={jobs} emptyMessage={t('listings.jobs.empty')} pagination={pagination} />
    </S.Container>
  );
};
