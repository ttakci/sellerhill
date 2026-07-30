import { ListingJobStatus, type ListingJobDto } from '@repo/shared';
import {
  ProgressBar,
  StatusBadge,
  Text,
  formatDate,
  getLocaleConfig,
  type TableColumn,
  type ViewMode,
} from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetListingJobsQuery } from '../api/listings.api';

import { ListingJobsPageComponent } from './ListingJobsPage.component';
import * as S from './ListingJobsPage.style';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

const jobPercent = (job: ListingJobDto): number =>
  job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;

export const ListingJobsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const { locale } = getLocaleConfig(i18n.language);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /*
   * Server-paginated. This endpoint is polled every 5s, so pulling the whole
   * job table and filtering/slicing it here meant the payload grew for the life
   * of the account and every poll re-downloaded all of it.
   */
  const { data, isLoading } = useGetListingJobsQuery(
    {
      page,
      limit: rowsPerPage,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
    },
    { pollingInterval: 5000, refetchOnMountOrArgChange: true }
  );

  /* Memoised: `?? []` would hand a fresh array to every consumer on each
     render and defeat their memoisation. */
  const jobs = useMemo(() => data?.items ?? [], [data]);
  const totalCount = data?.total ?? 0;
  const isInitialLoading = isLoading && jobs.length === 0;

  const statusLabel = useCallback(
    (status: ListingJobStatus | string) => {
      const key = String(status).toLowerCase();
      const path = `listings.jobs.status.${key}`;
      const translated = t(path);
      return translated === path ? key : translated;
    },
    [t]
  );

  const formatJobDate = useCallback(
    (iso: string) =>
      formatDate(iso, locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale]
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('listings.jobs.filters.allStatuses') },
      { value: ListingJobStatus.PENDING, label: t('listings.jobs.status.pending') },
      { value: ListingJobStatus.PROCESSING, label: t('listings.jobs.status.processing') },
      { value: ListingJobStatus.COMPLETED, label: t('listings.jobs.status.completed') },
      { value: ListingJobStatus.FAILED, label: t('listings.jobs.status.failed') },
    ],
    [t]
  );

  const hasActiveFilters = Boolean(search.trim() || statusFilter);

  const columns: TableColumn<ListingJobDto>[] = useMemo(
    () => [
      {
        key: 'id',
        header: t('listings.jobs.table.id'),
        render: (_value, job) => (
          <S.MonoId variant="body-sm" weight="semibold" color="text.primary">
            {job.id.slice(0, 8)}…
          </S.MonoId>
        ),
      },
      {
        key: 'status',
        header: t('listings.jobs.table.status'),
        render: (_value, job) => (
          <StatusBadge status={String(job.status).toLowerCase()} size="sm">
            {statusLabel(job.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'progress',
        header: t('listings.jobs.table.progress'),
        render: (_value, job) => {
          const percent = jobPercent(job);
          return (
            <S.TableProgress>
              <Text variant="caption" color="text.secondary" weight="medium">
                {percent}% · {job.processedCount}/{job.totalAsins}
              </Text>
              <ProgressBar value={percent} size="sm" />
            </S.TableProgress>
          );
        },
      },
      {
        key: 'stats',
        header: t('listings.jobs.table.stats'),
        render: (_value, job) => (
          <S.TableStats>
            <Text color="semantic.success" weight="semibold" variant="body-sm">
              {job.successCount} {t('listings.jobs.stats.success')}
            </Text>
            <Text color="semantic.error" weight="semibold" variant="body-sm">
              {job.failedCount} {t('listings.jobs.stats.failed')}
            </Text>
            <Text color="text.tertiary" variant="body-sm">
              / {job.totalAsins}
            </Text>
          </S.TableStats>
        ),
      },
      {
        key: 'createdAt',
        header: t('listings.jobs.table.createdAt'),
        render: (_value, job) => (
          <Text variant="body-sm" color="text.secondary">
            {formatJobDate(job.createdAt)}
          </Text>
        ),
      },
    ],
    [t, statusLabel, formatJobDate]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string | number) => {
    setStatusFilter(String(value));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const handleJobClick = useCallback(
    (jobId: string) => {
      localeNavigate(`/listings/jobs/${jobId}`);
    },
    [localeNavigate]
  );

  const handleBack = useCallback(() => {
    localeNavigate('/listings');
  }, [localeNavigate]);

  const handleDownload = useCallback(() => {
    const headers = [
      t('listings.jobs.table.id'),
      t('listings.jobs.table.status'),
      t('listings.jobs.table.processed'),
      t('listings.jobs.stats.success'),
      t('listings.jobs.stats.failed'),
      t('listings.jobs.table.total'),
      t('listings.jobs.table.createdAt'),
    ];
    const rows = jobs.map((job) =>
      [
        job.id,
        job.status,
        job.processedCount,
        job.successCount,
        job.failedCount,
        job.totalAsins,
        new Date(job.createdAt).toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
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
    URL.revokeObjectURL(url);
  }, [jobs, t]);

  return (
    <EbayAccountGuard>
      <ListingJobsPageComponent
        jobs={jobs}
        totalCount={totalCount}
        isInitialLoading={isInitialLoading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearchChange={handleSearchChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        statusOptions={statusOptions}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        columns={columns}
        onJobClick={handleJobClick}
        onDownload={handleDownload}
        onBack={handleBack}
        formatPercent={jobPercent}
        formatJobDate={formatJobDate}
        statusLabel={statusLabel}
        pagination={{
          count: totalCount,
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
