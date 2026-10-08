import { ListingJobDatePreset, ListingJobStatus, type ListingJobDto, type ListingJobsQueryDto } from '@repo/shared';
import { ProgressBar, Badge, Button, Text, formatDate, getLocaleConfig, type TableColumn, type ViewMode, Icon } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useCancelListingJobMutation, useGetListingJobsQuery } from '../api/listings.api';

import { ListingJobsPageComponent } from './ListingJobsPage.component';
import * as S from './ListingJobsPage.style';
import { jobStatusBadgeVariant } from './shared/job-status-badge';
import { resolveJobDateRange } from './utils/jobDateRange';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { useLocale } from '@/utils/useLocale';

const jobPercent = (job: ListingJobDto): number =>
  job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;

const JOB_SORT_KEYS: NonNullable<ListingJobsQueryDto['sortBy']>[] = ['status', 'progress', 'stats', 'createdAt'];

export const ListingJobsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const { locale } = getLocaleConfig(i18n.language);
  /**
   * Read once, on mount — this page's filters are local state, not
   * URL-synced. The Action Center's `LISTING_JOB_FAILURES` item deep-links
   * here with `?hasFailures=true&datePreset=last7Days`; without seeding
   * initial state from those params, the link landed on every job ever run,
   * not the ones the item counted.
   */
  const [searchParams] = useSearchParams();
  // The top bar's active store; a switch starts the list over on page 1.
  const { activeStoreId } = useActiveStore();
  const storeFilter = activeStoreId ?? '';

  const [page, setPage] = useState(1);
  const [pageStore, setPageStore] = useState(storeFilter);
  if (pageStore !== storeFilter) {
    setPageStore(storeFilter);
    setPage(1);
  }
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') ?? '');
  const [datePreset, setDatePreset] = useState<ListingJobDatePreset>(() => {
    const raw = searchParams.get('datePreset');
    return Object.values(ListingJobDatePreset).find((preset) => preset === raw) ?? ListingJobDatePreset.ALL;
  });
  const [hasFailures, setHasFailures] = useState(() => searchParams.get('hasFailures') === 'true');
  const [sortBy, setSortBy] = useState<NonNullable<ListingJobsQueryDto['sortBy']>>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // A discoverable dropdown, not a typed date guess — resolved to explicit
  // YYYY-MM-DD bounds once per render, not re-derived inside the query call.
  const dateRange = useMemo(() => resolveJobDateRange(datePreset), [datePreset]);

  /*
   * Server-paginated. This endpoint is polled every 5s, so pulling the whole
   * job table and filtering/slicing it here meant the payload grew for the life
   * of the account and every poll re-downloaded all of it.
   */
  const { data, isLoading, refetch } = useGetListingJobsQuery(
    {
      page,
      limit: rowsPerPage,
      search: search.trim() || undefined,
      status: statusFilter || undefined,
      dateFrom: dateRange.dateFrom,
      dateTo: dateRange.dateTo,
      hasFailures: hasFailures || undefined,
      ebayAccountId: storeFilter || undefined,
      sortBy,
      sortOrder: sortDirection,
    },
    { pollingInterval: 5000, refetchOnMountOrArgChange: true, skip: !storeFilter }
  );

  /* Memoised: `?? []` would hand a fresh array to every consumer on each
     render and defeat their memoisation. */
  const jobs = useMemo(() => data?.items ?? [], [data]);
  const totalCount = data?.total ?? 0;
  const isInitialLoading = isLoading && jobs.length === 0;
  const [cancelJob, { isLoading: isCancelling }] = useCancelListingJobMutation();
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

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

  const datePresetOptions = useMemo(
    () => [
      { value: ListingJobDatePreset.ALL, label: t('listings.jobs.filters.datePreset.all') },
      { value: ListingJobDatePreset.TODAY, label: t('listings.jobs.filters.datePreset.today') },
      { value: ListingJobDatePreset.LAST_7_DAYS, label: t('listings.jobs.filters.datePreset.last7Days') },
      { value: ListingJobDatePreset.LAST_30_DAYS, label: t('listings.jobs.filters.datePreset.last30Days') },
      { value: ListingJobDatePreset.THIS_MONTH, label: t('listings.jobs.filters.datePreset.thisMonth') },
    ],
    [t]
  );

  const hasActiveFilters = Boolean(
    search.trim() || statusFilter || datePreset !== ListingJobDatePreset.ALL || hasFailures
  );

  const allColumns: TableColumn<ListingJobDto>[] = useMemo(
    () => [
      {
        key: 'id',
        header: t('listings.jobs.table.id'),
        width: '8.5rem',
        render: (_value, job) => (
          <S.MonoId variant="body-sm" weight="semibold" color="text.primary">
            {job.id}
          </S.MonoId>
        ),
      },
      {
        key: 'status',
        sortable: true,
        header: t('listings.jobs.table.status'),
        width: '7rem',
        render: (_value, job) => (
          <Badge variant={jobStatusBadgeVariant(job.status)} size="sm" solid>
            {statusLabel(job.status)}
          </Badge>
        ),
      },
      {
        key: 'progress',
        sortable: true,
        header: t('listings.jobs.table.progress'),
        width: '9rem',
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
        sortable: true,
        header: t('listings.jobs.table.stats'),
        width: '13.5rem',
        align: 'right',
        render: (_value, job) => (
          <S.TableStats>
            <Text color="semantic.success" weight="semibold" variant="body-sm" numeric>
              {job.successCount} {t('listings.jobs.stats.success')}
            </Text>
            <Text color="semantic.error" weight="semibold" variant="body-sm" numeric>
              {job.failedCount} {t('listings.jobs.stats.failed')}
            </Text>
            <Text color="text.tertiary" variant="body-sm" numeric>
              / {job.totalAsins}
            </Text>
          </S.TableStats>
        ),
      },
      {
        key: 'createdAt',
        sortable: true,
        header: t('listings.jobs.table.createdAt'),
        width: '9.5rem',
        render: (_value, job) => (
          <Text variant="body-sm" color="text.secondary">
            {formatJobDate(job.createdAt)}
          </Text>
        ),
      },
      {
        key: 'actions',
        header: t('listings.jobs.table.actions'),
        width: '5.5rem',
        align: 'right',
        render: (_value, job) => {
          const canCancel =
            job.status === ListingJobStatus.PENDING || job.status === ListingJobStatus.PROCESSING;
          return canCancel ? (
            <Button
              variant="danger"
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setCancelTargetId(job.id);
              }}
              isLoading={isCancelling && cancelTargetId === job.id}
              disabled={isCancelling}
            >
              <Icon name="x" size={16} />
              <Text variant="body-sm">{t('listings.jobs.details.cancel')}</Text>
            </Button>
          ) : null;
        },
      },
    ],
    [t, statusLabel, formatJobDate, isCancelling, cancelTargetId]
  );

  // Match the listings/orders tables: sellers can hide and reorder columns,
  // while the job identifier remains the stable anchor for every row.
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const orderedKeys = useMemo(() => {
    const all = allColumns.map((column) => column.key);
    return [...columnOrder.filter((key) => all.includes(key)), ...all.filter((key) => !columnOrder.includes(key))];
  }, [allColumns, columnOrder]);
  const columns = useMemo(
    () =>
      orderedKeys
        .filter((key) => !hiddenColumnKeys.includes(key))
        .map((key) => allColumns.find((column) => column.key === key))
        .filter((column): column is TableColumn<ListingJobDto> => Boolean(column)),
    [allColumns, hiddenColumnKeys, orderedKeys]
  );
  const columnOptions = useMemo(
    () =>
      orderedKeys.map((key) => {
        const column = allColumns.find((candidate) => candidate.key === key);
        return {
          key,
          label: typeof column?.header === 'string' ? column.header : key,
          alwaysVisible: key === 'id' || key === 'actions',
        };
      }),
    [allColumns, orderedKeys]
  );
  const visibleColumnKeys = useMemo(
    () => orderedKeys.filter((key) => !hiddenColumnKeys.includes(key)),
    [hiddenColumnKeys, orderedKeys]
  );
  const handleToggleColumn = useCallback((key: string) => {
    setHiddenColumnKeys((current) =>
      current.includes(key) ? current.filter((columnKey) => columnKey !== key) : [...current, key]
    );
  }, []);
  const handleMoveColumn = useCallback(
    (key: string, direction: -1 | 1) => {
      const index = orderedKeys.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= orderedKeys.length) {
        return;
      }
      const next = [...orderedKeys];
      [next[index], next[target]] = [next[target], next[index]];
      setColumnOrder(next);
    },
    [orderedKeys]
  );

  const sortOptions = useMemo(
    () =>
      JOB_SORT_KEYS.flatMap((key) => {
        const column = allColumns.find((candidate) => candidate.key === key);
        const label = typeof column?.header === 'string' ? column.header : key;
        return [
          { value: `${key}:desc`, label: `${label} ↓` },
          { value: `${key}:asc`, label: `${label} ↑` },
        ];
      }),
    [allColumns]
  );
  const handleSortChange = useCallback((value: string | number) => {
    const [nextKey, nextDirection] = String(value).split(':');
    if (!JOB_SORT_KEYS.includes(nextKey as NonNullable<ListingJobsQueryDto['sortBy']>)) {
      return;
    }
    setSortBy(nextKey as NonNullable<ListingJobsQueryDto['sortBy']>);
    setSortDirection(nextDirection === 'asc' ? 'asc' : 'desc');
    setPage(1);
  }, []);
  const handleColumnSort = useCallback(
    (columnKey: string) => {
      if (!JOB_SORT_KEYS.includes(columnKey as NonNullable<ListingJobsQueryDto['sortBy']>)) {
        return;
      }
      setSortBy(columnKey as NonNullable<ListingJobsQueryDto['sortBy']>);
      setSortDirection((current) => (sortBy === columnKey && current === 'desc' ? 'asc' : 'desc'));
      setPage(1);
    },
    [sortBy]
  );

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: string | number) => {
    setStatusFilter(String(value));
    setPage(1);
  }, []);

  const handleDatePresetChange = useCallback((value: string | number) => {
    setDatePreset(value as ListingJobDatePreset);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setDatePreset(ListingJobDatePreset.ALL);
    setHasFailures(false);
    setPage(1);
  }, []);

  const handleJobClick = useCallback(
    (jobId: string) => {
      localeNavigate(`/listings/jobs/${jobId}`);
    },
    [localeNavigate]
  );

  const handleCancelConfirm = useCallback(async () => {
    if (!cancelTargetId) {
      return;
    }
    try {
      await cancelJob(cancelTargetId).unwrap();
      setCancelTargetId(null);
      await refetch();
    } catch {
      // The mutation error remains available to RTK Query; keep the dialog open
      // so the seller can retry instead of silently losing the chosen job.
    }
  }, [cancelJob, cancelTargetId, refetch]);

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
    link.setAttribute('download', `sellerhill_jobs_${new Date().toISOString().split('T')[0]}.csv`);
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
        datePreset={datePreset}
        onDatePresetChange={handleDatePresetChange}
        datePresetOptions={datePresetOptions}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        columns={columns}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={handleToggleColumn}
        onMoveColumn={handleMoveColumn}
        sortOptions={sortOptions}
        sortValue={`${sortBy}:${sortDirection}`}
        onSortChange={handleSortChange}
        sortColumn={sortBy}
        sortDirection={sortDirection}
        onSort={handleColumnSort}
        onJobClick={handleJobClick}
        cancellingJobId={isCancelling ? cancelTargetId : null}
        cancelTargetId={cancelTargetId}
        onCancelRequest={setCancelTargetId}
        onCancelDismiss={() => setCancelTargetId(null)}
        onCancelConfirm={() => void handleCancelConfirm()}
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
