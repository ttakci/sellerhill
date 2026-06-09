import { StatusBadge, useLoading } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetListingJobsQuery } from '../api/listings.api';

import { ListingJobsPageComponent } from './ListingJobsPage.component';
import * as S from './ListingJobsPage.style';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

export const ListingJobsPageContainer: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dynamic polling from listingsApi
  const { data: jobs = [], isLoading } = useGetListingJobsQuery(undefined, {
    pollingInterval: 5000,
    refetchOnMountOrArgChange: true,
  });

  useLoading(isLoading);

  const handleViewDetails = useCallback(
    (jobId: string) => {
      localeNavigate(`/listings/jobs/${jobId}`);
    },
    [localeNavigate]
  );

  const paginatedJobs = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return jobs.slice(start, start + rowsPerPage);
  }, [jobs, page, rowsPerPage]);

  const columns = useMemo(
    () => [
      {
        key: 'id',
        header: t('listings.jobs.table.id'),
        render: (id: string) => (
          <S.JobIdBadge variant="neutral" size="sm">
            {id.substring(0, 8)}...
          </S.JobIdBadge>
        ),
      },
      {
        key: 'status',
        header: t('listings.jobs.table.status'),
        render: (status: string) => (
          <StatusBadge status={status.toLowerCase()}>{t(`listings.jobs.status.${status.toLowerCase()}`)}</StatusBadge>
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
            <S.SuccessText variant="body-sm" weight="bold" color="semantic.success">
              {job.successCount} {t('listings.jobs.stats.success')}
            </S.SuccessText>
            <S.FailedText variant="body-sm" weight="bold" color="semantic.error">
              {job.failedCount} {t('listings.jobs.stats.failed')}
            </S.FailedText>
            <S.TotalText variant="body-sm" weight="medium" color="text.tertiary">
              / {job.totalAsins}
            </S.TotalText>
          </S.StatsContainer>
        ),
      },
      {
        key: 'createdAt',
        header: t('listings.jobs.table.createdAt'),
        render: (date: string) => (
          <S.DateText variant="body-sm" weight="medium" color="text.secondary">
            {new Date(date).toLocaleString(t('translation:common.languageCode') || 'en-US')}
          </S.DateText>
        ),
      },
      {
        key: 'actions',
        header: t('listings.jobs.table.actions'),
        align: 'right' as const,
        render: (_: any, job: any) => (
          <S.ActionButton variant="secondary" onClick={() => handleViewDetails(job.id)}>
            {t('translation:common.details')}
          </S.ActionButton>
        ),
      },
    ],
    [t, handleViewDetails]
  );

  const handleDownload = () => {
    const headers = [
      t('listings.jobs.table.id'),
      t('listings.jobs.table.status'),
      t('listings.jobs.table.total'),
      t('listings.jobs.table.createdAt'),
    ];
    const rows = jobs.map((job) =>
      [job.id, job.status, job.totalAsins, new Date(job.createdAt).toLocaleString()].map((v) => `"${v}"`).join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `zonds_jobs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <EbayAccountGuard>
      <ListingJobsPageComponent
      columns={columns}
      jobs={paginatedJobs}
      isLoading={isLoading}
      onDownload={handleDownload}
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
        labelRowsPerPage: t('translation:common.rowsPerPage'),
        labelInfo: t('translation:common.showing_info'),
      }}
    />
    </EbayAccountGuard>
  );
};
