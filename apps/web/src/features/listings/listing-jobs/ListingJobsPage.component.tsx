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
import { JobProgressRing } from './shared/JobProgressRing';

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
  datePreset,
  onDatePresetChange,
  datePresetOptions,
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
       * Job id top-left / status badge top-right (opposite corners of the
       * header row instead of a labeled meta row), created date pushed to
       * the far right of the progress row, label-above-value stats box, and
       * a "Detay ->" footer instead of a bare icon.
       */
      <S.JobCard key={job.id} variant="elevated" onClick={() => onJobClick(job.id)}>
        <S.JobCardHeader>
          <S.MonoId variant="body-sm" weight="semibold" color="text.secondary">
            {shortId}
          </S.MonoId>
          <StatusBadge status={String(job.status).toLowerCase()} size="sm">
            {statusLabel(job.status)}
          </StatusBadge>
        </S.JobCardHeader>

        <S.JobCardBody>
          <S.ProgressRow>
            <S.ProgressMain>
              <JobProgressRing percent={percent} />
              <S.ProgressCounts>
                <Text variant="body" weight="semibold" numeric>
                  {t('listings.jobs.card.progressCount', {
                    processed: job.processedCount,
                    total: job.totalAsins,
                  })}
                </Text>
              </S.ProgressCounts>
            </S.ProgressMain>
            <Text variant="caption" color="text.tertiary">
              {formatJobDate(job.createdAt)}
            </Text>
          </S.ProgressRow>

          <S.StatsGrid>
            <S.StatCell>
              <S.StatLabel variant="caption" color="text.tertiary">
                {t('listings.jobs.stats.success')}
              </S.StatLabel>
              <S.StatValue variant="body-sm" weight="bold" $tone="positive" numeric>
                {job.successCount}
              </S.StatValue>
            </S.StatCell>
            <S.StatCell>
              <S.StatLabel variant="caption" color="text.tertiary">
                {t('listings.jobs.stats.failed')}
              </S.StatLabel>
              <S.StatValue
                variant="body-sm"
                weight="bold"
                $tone={job.failedCount > 0 ? 'negative' : 'default'}
                numeric
              >
                {job.failedCount}
              </S.StatValue>
            </S.StatCell>
            {remaining > 0 ? (
              <S.StatCell>
                <S.StatLabel variant="caption" color="text.tertiary">
                  {t('listings.jobs.stats.remaining')}
                </S.StatLabel>
                <S.StatValue variant="body-sm" weight="bold" numeric>
                  {remaining}
                </S.StatValue>
              </S.StatCell>
            ) : null}
          </S.StatsGrid>
        </S.JobCardBody>

        <S.Footer>
          <S.DetailAction>
            <Text variant="body-sm" weight="semibold" color="brand.primary">
              {t('translation:common.details')}
            </Text>
            <Icon name="arrow-right" size={14} color="brand.primary" />
          </S.DetailAction>
        </S.Footer>
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
        icon="clipboard-list"
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
              <S.SelectWrapper>
                <Select
                  value={datePreset}
                  onChange={onDatePresetChange}
                  options={datePresetOptions}
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
