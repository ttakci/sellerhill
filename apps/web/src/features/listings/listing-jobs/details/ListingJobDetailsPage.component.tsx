import { Icon, PageHeader, Table } from '@repo/ui';
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
      <S.BackButton variant="text" onClick={onBack}>
        <Icon name="arrow_back" size={20} />
        {t('translation:common.back')}
      </S.BackButton>
      <PageHeader
        title={`${t('listings.jobs.details.title')} (${jobId})`}
        actions={
          <S.RefreshButton variant="secondary" size="small" onClick={onRefresh} disabled={isLoading}>
            <Icon name="sync" size={20} />
            {t('translation:common.actions.refresh')}
          </S.RefreshButton>
        }
      />

      <Table columns={columns} data={items} emptyMessage={t('listings.jobs.items.empty')} />
    </S.Container>
  );
};
