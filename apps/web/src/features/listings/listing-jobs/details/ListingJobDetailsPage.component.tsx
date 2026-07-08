import { Button, PageHeader, Table, Text } from '@repo/ui';
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
          <Text>{t('translation:common.back')}</Text>
        </Button>
        <Button variant="primary" onClick={onRefresh} disabled={isLoading}>
          <Text>{t('translation:common.actions.refresh')}</Text>
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
