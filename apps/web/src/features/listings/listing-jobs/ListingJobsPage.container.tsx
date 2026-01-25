import { useLoading } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGetListingJobsQuery } from '../api/listings.api';
import { ListingJobsPageComponent } from './ListingJobsPage.component';
import * as S from './ListingJobsPage.style';

export const ListingJobsPageContainer: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dynamic polling from listingsApi
  const {
    data: jobs = [],
    isLoading,
    refetch,
  } = useGetListingJobsQuery(undefined, {
    pollingInterval: 5000,
    refetchOnMountOrArgChange: true,
  });

  useLoading(isLoading);

  const handleViewDetails = (jobId: string) => {
    navigate(`/listings/jobs/${jobId}`);
  };

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return jobs.slice(start, start + rowsPerPage);
  }, [jobs, page, rowsPerPage]);

  const columns = useMemo(
    () => [
      {
        key: 'id',
        header: t('listings.jobs.table.id'),
        render: (id: string) => <S.JobIdBadge>{id.substring(0, 8)}...</S.JobIdBadge>,
      },
      {
        key: 'status',
        header: t('listings.jobs.table.status'),
        render: (status: string) => (
          <S.StatusBadge $status={status}>{t(`listings.jobs.status.${status.toLowerCase()}`)}</S.StatusBadge>
        ),
      },
      {
        key: 'progress',
        header: t('listings.jobs.table.progress'),
        render: (_: any, job: any) => {
          const percent = job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;
          return (
            <S.ProgressContainer>
              <S.ProgressInfo>
                <span>{percent}%</span>
              </S.ProgressInfo>
              <S.ProgressBar>
                <S.ProgressFill $percent={percent} />
              </S.ProgressBar>
            </S.ProgressContainer>
          );
        },
      },
      {
        key: 'stats',
        header: t('listings.jobs.table.stats'),
        render: (_: any, job: any) => (
          <S.StatsContainer>
            <S.SuccessText>
              {job.successCount} {t('listings.jobs.stats.success')}
            </S.SuccessText>
            <S.FailedText>
              {job.failedCount} {t('listings.jobs.stats.failed')}
            </S.FailedText>
            <S.TotalText>/ {job.totalAsins}</S.TotalText>
          </S.StatsContainer>
        ),
      },
      {
        key: 'createdAt',
        header: t('listings.jobs.table.createdAt'),
        render: (date: string) => (
          <S.DateText>{new Date(date).toLocaleString(t('translation:common.languageCode') || 'en-US')}</S.DateText>
        ),
      },
      {
        key: 'actions',
        header: t('listings.jobs.table.actions'),
        align: 'right' as const,
        render: (_: any, job: any) => (
          <S.ActionButton onClick={() => handleViewDetails(job.id)}>{t('translation:common.details')}</S.ActionButton>
        ),
      },
    ],
    [t, navigate]
  );

  const handleRefresh = () => {
    void refetch();
  };

  return (
    <ListingJobsPageComponent
      columns={columns}
      jobs={paginatedJobs}
      isLoading={isLoading}
      onRefresh={handleRefresh}
      onViewDetails={handleViewDetails}
      pagination={{
        count: jobs.length,
        page,
        rowsPerPage,
        onPageChange: setPage,
        onRowsPerPageChange: (val) => {
          setRowsPerPage(val);
          setPage(1);
        },
      }}
    />
  );
};
