import { IdBadge, StatusBadge, useLoading } from '@repo/ui';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useGetJobItemsQuery } from '../../api/listings.api';

import { ListingJobDetailsPageComponent } from './ListingJobDetailsPage.component';
import * as S from './ListingJobDetailsPage.style';

import { useLocale } from '@/utils/useLocale';

export const ListingJobDetailsPageContainer: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const { jobId } = useParams<{ jobId: string }>();
  const { localeNavigate } = useLocale();

  const {
    data: items = [],
    isLoading,
    refetch,
  } = useGetJobItemsQuery(jobId || '', {
    pollingInterval: 3000,
    skip: !jobId,
  });

  useLoading(isLoading);

  const columns = useMemo(
    () => [
      {
        key: 'asin',
        header: t('listings.jobs.items.asin'),
        render: (asin: string) => <IdBadge id={asin} storeType="amazon" size="sm" />,
      },
      {
        key: 'status',
        header: t('listings.jobs.items.status'),
        render: (status: string) => (
          <StatusBadge status={status.toLowerCase()}>{t(`listings.status.${status.toLowerCase()}`)}</StatusBadge>
        ),
      },
      {
        key: 'ebayItemId',
        header: t('listings.jobs.items.ebayId'),
        render: (id: string) => (id ? <IdBadge id={id} storeType="ebay" size="sm" /> : '-'),
      },
      {
        key: 'errorMessage',
        header: t('listings.jobs.items.error'),
        render: (msg: string) =>
          msg ? (
            <S.ErrorContainer>
              <S.ExceptionBadge>{msg}</S.ExceptionBadge>
            </S.ErrorContainer>
          ) : (
            '-'
          ),
      },
    ],
    [t]
  );

  const handleBack = () => {
    localeNavigate('/listings/jobs');
  };

  const handleRefresh = () => {
    void refetch();
  };

  if (!jobId) {
    return null;
  }

  return (
    <ListingJobDetailsPageComponent
      jobId={jobId}
      items={items}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      onBack={handleBack}
      columns={columns}
    />
  );
};
