import { StatusBadge, useLoading } from '@repo/ui';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetJobItemsQuery } from '../../api/listings.api';
import { ListingJobDetailsPageComponent } from './ListingJobDetailsPage.component';
import * as S from './ListingJobDetailsPage.style';

export const ListingJobDetailsPageContainer: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

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
        render: (asin: string) => <S.AsinText variant="mono" weight="semibold" color="brand.primary">{asin}</S.AsinText>,
      },
      {
        key: 'status',
        header: t('listings.jobs.items.status'),
        render: (status: string) => (
          <StatusBadge status={status.toLowerCase()}>{t(`listings.jobs.status.${status.toLowerCase()}`)}</StatusBadge>
        ),
      },
      {
        key: 'ebayItemId',
        header: t('listings.jobs.items.ebayId'),
        render: (id: string) => (id ? <S.JobIdBadge variant="neutral" size="sm">{id}</S.JobIdBadge> : '-'),
      },
      {
        key: 'errorMessage',
        header: t('listings.jobs.items.error'),
        render: (msg: string) =>
          msg ? (
            <S.ErrorContainer>
              <S.ErrorText>{msg.split(' | ')[0]}</S.ErrorText>
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
    navigate('/listings/jobs');
  };

  const handleRefresh = () => {
    void refetch();
  };

  if (!jobId) return null;

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
