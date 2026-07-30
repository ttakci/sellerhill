import type { ListingJobDto } from '@repo/shared';
import {
  Button,
  DataTable,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  Select,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingJobsPage.style';
import type { ListingJobsPageComponentProps } from './ListingJobsPage.types';

export const ListingJobsPageComponent: React.FC<ListingJobsPageComponentProps> = ({
  jobs,
  totalCount,
  isInitialLoading,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  statusOptions,
  hasActiveFilters,
  onClearFilters,
  columns,
  onJobClick,
  onDownload,
  onBack,
  formatPercent,
  formatJobDate,
  statusLabel,
  pagination,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  const isEmpty = !isInitialLoading && totalCount === 0 && !hasActiveFilters;
  const isFilterEmpty = !isInitialLoading && jobs.length === 0 && hasActiveFilters;
  const showChrome = !isEmpty;

  const renderGridCard = (job: ListingJobDto) => {
    const percent = formatPercent(job);
    const shortId = job.id.slice(0, 8);
    const remaining = Math.max(job.totalAsins - job.processedCount, 0);

    return (
      /*
       * Redesigned: the card was nine `caption` texts stacked with dot
       * separators — a wall of 12px grey with no focal point, and a fake
       * "open detail" link inside an already-clickable card. Progress is now
       * the headline, status leads, and the technical id is demoted to meta.
       */
      <S.JobCard key={job.id} variant="elevated" onClick={() => onJobClick(job.id)}>
        <S.JobCardHeader>
          <StatusBadge status={String(job.status).toLowerCase()} size="sm">
            {statusLabel(job.status)}
          </StatusBadge>
        </S.JobCardHeader>

        <S.JobCardBody>
          <S.ProgressRow>
            <S.ProgressRing $percent={percent} role="img" aria-label={`${percent}%`}>
              <S.ProgressRingValue variant="body-sm" weight="semibold" numeric>
                {percent}%
              </S.ProgressRingValue>
            </S.ProgressRing>
            <S.ProgressCounts>
              <Text variant="body" weight="semibold" numeric>
                {t('listings.jobs.card.progressCount', {
                  processed: job.processedCount,
                  total: job.totalAsins,
                })}
              </Text>
              <Text variant="caption" color="text.tertiary">
                {formatJobDate(job.createdAt)}
              </Text>
            </S.ProgressCounts>
          </S.ProgressRow>

          <S.StatsInline>
            <S.StatInline>
              <Text variant="body-sm" weight="semibold" color="semantic.success" numeric>
                {job.successCount}
              </Text>
              <Text variant="caption" color="text.tertiary">
                {t('listings.jobs.stats.success')}
              </Text>
            </S.StatInline>
            <S.StatInline>
              <Text
                variant="body-sm"
                weight="semibold"
                color={job.failedCount > 0 ? 'semantic.error' : 'text.tertiary'}
                numeric
              >
                {job.failedCount}
              </Text>
              <Text variant="caption" color="text.tertiary">
                {t('listings.jobs.stats.failed')}
              </Text>
            </S.StatInline>
            {remaining > 0 ? (
              <S.StatInline>
                <Text variant="body-sm" weight="semibold" color="text.secondary" numeric>
                  {remaining}
                </Text>
                <Text variant="caption" color="text.tertiary">
                  {t('listings.jobs.stats.remaining')}
                </Text>
              </S.StatInline>
            ) : null}
          </S.StatsInline>
        </S.JobCardBody>

        <S.JobCardFooter>
          <S.MonoId variant="caption" color="text.tertiary">
            {shortId}
          </S.MonoId>
          <S.OpenAffordance aria-hidden>
            <Icon name="arrow-right" size="sm" />
          </S.OpenAffordance>
        </S.JobCardFooter>
      </S.JobCard>
    );
  };

  const emptyState = (() => {
    if (isInitialLoading) {
      return (
        <EmptyState
          icon="loader"
          title={t('listings.jobs.emptyLoading')}
          description={t('listings.jobs.subtitle')}
          size="md"
        />
      );
    }
    if (isFilterEmpty) {
      return (
        <EmptyState
          icon="search"
          title={t('listings.empty.filtersTitle')}
          description={t('listings.empty.filtersSubtitle')}
          action={t('listings.empty.filtersAction')}
          onAction={onClearFilters}
          size="lg"
        />
      );
    }
    return (
      <EmptyState
        icon="layers"
        title={t('listings.jobs.emptyTitle')}
        description={t('listings.jobs.emptySubtitle')}
        size="lg"
      />
    );
  })();

  return (
    <S.Container>
      <PageHeader
        title={t('listings.jobs.title')}
        subtitle={t('listings.jobs.subtitle')}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      {showChrome && (
        <S.FilterBarWrapper>
          <S.FilterBar>
            <S.FilterBarRow>
              <S.SearchWrapper>
                <SearchField
                  value={search}
                  onChange={onSearchChange}
                  placeholder={t('listings.jobs.filters.searchPlaceholder')}
                  size="medium"
                  fullWidth
                />
              </S.SearchWrapper>
              <S.SelectWrapper>
                <Select
                  value={statusFilter}
                  onChange={onStatusFilterChange}
                  options={statusOptions}
                  placeholder={t('listings.jobs.filters.allStatuses')}
                  size="medium"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.FilterActions>
                <S.ResultCount variant="caption" weight="medium" color="text.secondary">
                  {t('listings.jobs.filters.resultCount', { count: pagination.count })}
                </S.ResultCount>
                {hasActiveFilters && (
                  <Button variant="text" size="small" onClick={onClearFilters}>
                    <Text variant="body">{t('listings.filters.clearAll')}</Text>
                  </Button>
                )}
              </S.FilterActions>
            </S.FilterBarRow>
          </S.FilterBar>
        </S.FilterBarWrapper>
      )}

      <DataTable
        gridMinItemWidth="20rem"
        columns={columns}
        data={jobs}
        renderGridCard={renderGridCard}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        defaultViewMode="grid"
        hideViewToggle={isEmpty || isInitialLoading}
        emptyContent={emptyState}
        emptyMessage={t('listings.jobs.empty')}
        onDownload={isEmpty || isInitialLoading ? undefined : onDownload}
        pagination={pagination}
        onRowClick={(row) => onJobClick(row.id)}
      />
    </S.Container>
  );
};
