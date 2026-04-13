import { Button, Icon, PageHeader, Table } from '@repo/ui';
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
      <S.HeaderRow>
        <Button variant="secondary" onClick={onBack}>
          <Icon name="arrow_back" size={20} />
          {t('translation:common.back')}
        </Button>
        <Button variant="primary" onClick={onRefresh} disabled={isLoading}>
          <Icon name="sync" size={20} />
          {t('translation:common.actions.refresh')}
        </Button>
      </S.HeaderRow>
      <S.HeaderRowTitle>
        <PageHeader
          title={`${t('listings.jobs.details.title')} (${jobId})`}
        />
      </S.HeaderRowTitle>

      <Table columns={columns} data={items} emptyMessage={t('listings.jobs.items.empty')} />
    </S.Container>
  );
};
