import { ListingJobStatus, type ListingJobDto } from '@repo/shared';
import {
  Badge,
  Button,
  ConfirmModal,
  DataTable,
  EmptyState,
  Icon,
  PageHeader,
  SearchField,
  Select,
  Text,
} from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import * as S from './ListingJobsPage.style';
import type { ListingJobsPageComponentProps } from './ListingJobsPage.types';
import { jobStatusBadgeVariant } from './shared/job-status-badge';

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
  columnOptions,
  visibleColumnKeys,
  onToggleColumn,
  onMoveColumn,
  sortOptions,
  sortValue,
  onSortChange,
  sortColumn,
  sortDirection,
  onSort,
  onJobClick,
  cancellingJobId,
  cancelTargetId,
  onCancelRequest,
  onCancelDismiss,
  onCancelConfirm,
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
    const remaining = Math.max(job.totalAsins - job.processedCount, 0);
    const isProcessing = job.status === ListingJobStatus.PROCESSING;
    const canCancel = job.status === ListingJobStatus.PENDING || isProcessing;
    const progressTone =
      job.successCount > 0
        ? 'positive'
        : job.status === ListingJobStatus.FAILED || (job.totalAsins > 0 && job.failedCount >= job.totalAsins)
          ? 'negative'
          : isProcessing
            ? 'active'
            : 'default';

    return (
      <S.JobCard key={job.id} variant="elevated" onClick={() => onJobClick(job.id)}>
        <S.JobCardTop>
          <S.JobCardHeader>
            <Badge variant={jobStatusBadgeVariant(job.status)} size="sm" solid>
              {statusLabel(job.status)}
            </Badge>
            {canCancel ? (
              <Button
                variant="danger"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  onCancelRequest(job.id);
                }}
                isLoading={cancellingJobId === job.id}
                disabled={Boolean(cancellingJobId)}
              >
                <Icon name="x" size={16} />
                <Text variant="body-sm">{t('listings.jobs.details.cancel')}</Text>
              </Button>
            ) : null}
          </S.JobCardHeader>

          <S.JobCardBody>
            <S.MetaList>
              <S.MetaLabel>
                <Text variant="body-sm" color="text.secondary">
                  {t('listings.jobs.table.id')}
                </Text>
              </S.MetaLabel>
              <S.MetaValue>
                <S.MonoId variant="body-sm" weight="bold" color="text.primary">
                  {job.id}
                </S.MonoId>
              </S.MetaValue>

              <S.MetaLabel>
                <Text variant="body-sm" color="text.secondary">
                  {t('listings.jobs.table.createdAt')}
                </Text>
              </S.MetaLabel>
              <S.MetaValue>
                <Text variant="body-sm" weight="bold" color="text.primary">
                  {formatJobDate(job.createdAt)}
                </Text>
              </S.MetaValue>

              <S.MetaLabel>
                <Text variant="body-sm" color="text.secondary">
                  {t('listings.jobs.table.processed')}
                </Text>
              </S.MetaLabel>
              <S.MetaValue>
                <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                  {job.processedCount}
                </Text>
              </S.MetaValue>

              <S.MetaLabel>
                <Text variant="body-sm" color="text.secondary">
                  {t('listings.jobs.table.total')}
                </Text>
              </S.MetaLabel>
              <S.MetaValue>
                <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                  {job.totalAsins}
                </Text>
              </S.MetaValue>
            </S.MetaList>

            <S.ProgressSignal
              $tone={progressTone}
              $active={isProcessing}
              role="status"
              aria-label={t('listings.jobs.card.progressLabel', { percent })}
            >
              <S.ProgressDot $tone={progressTone} $active={isProcessing} aria-hidden="true" />
              <S.ProgressCopy>
                <Text variant="caption" color="text.secondary">
                  {t('listings.jobs.table.progress')}
                </Text>
                <S.ProgressValue variant="metric-lg" weight="bold" numeric $tone={progressTone}>
                  %{percent}
                </S.ProgressValue>
              </S.ProgressCopy>
            </S.ProgressSignal>
          </S.JobCardBody>
        </S.JobCardTop>

        <S.StatsGrid>
          <S.StatCell>
            <S.StatLabel variant="caption" color="text.secondary">
              {t('listings.jobs.stats.success')}
            </S.StatLabel>
            <S.StatValue variant="body" weight="semibold" $tone="positive" numeric>
              {job.successCount}
            </S.StatValue>
          </S.StatCell>
          <S.StatCell>
            <S.StatLabel variant="caption" color="text.secondary">
              {t('listings.jobs.stats.failed')}
            </S.StatLabel>
            <S.StatValue variant="body" weight="semibold" $tone={job.failedCount > 0 ? 'negative' : 'default'} numeric>
              {job.failedCount}
            </S.StatValue>
          </S.StatCell>
          {remaining > 0 ? (
            <S.StatCell>
              <S.StatLabel variant="caption" color="text.secondary">
                {t('listings.jobs.stats.remaining')}
              </S.StatLabel>
              <S.StatValue variant="body" weight="semibold" numeric>
                {remaining}
              </S.StatValue>
            </S.StatCell>
          ) : null}
          <S.FooterActions>
            <S.DetailHint>
              <Text variant="caption" weight="semibold" color="brand.primary">
                {t('translation:common.details')}
              </Text>
              <Icon name="chevron-right" size={16} color="brand.primary" />
            </S.DetailHint>
          </S.FooterActions>
        </S.StatsGrid>
      </S.JobCard>
    );
  };

  const emptyState = (() => {
    if (isFilterEmpty) {
      return (
        <EmptyState
          icon="search"
          title={t('listings.empty.filtersTitle')}
          description={t('listings.empty.filtersSubtitle')}
          actionIcon="x"
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
                  size="small"
                  fullWidth
                />
              </S.SearchWrapper>
              <S.SelectWrapper>
                <Select
                  value={statusFilter}
                  onChange={onStatusFilterChange}
                  options={statusOptions}
                  placeholder={t('listings.jobs.filters.allStatuses')}
                  size="small"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.SelectWrapper>
                <Select
                  value={datePreset}
                  onChange={onDatePresetChange}
                  options={datePresetOptions}
                  size="small"
                  fullWidth
                />
              </S.SelectWrapper>
              <S.FilterActions>
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
        gridMinItemWidth="24rem"
        gridMaxColumns={3}
        downloadLabel={t('listings.actions.export')}
        resultLabel={
          <Trans
            i18nKey="listings.filters.resultListed"
            ns="listings"
            values={{ count: pagination.count }}
            components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
          />
        }
        columns={columns}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        columnManagerLabel={t('listings.table.columns')}
        sortOptions={sortOptions}
        sortValue={sortValue}
        onSortChange={onSortChange}
        sortLabel={t('listings.filters.sortLabel')}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={onSort}
        data={jobs}
        renderGridCard={renderGridCard}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        defaultViewMode="grid"
        hideViewToggle={isEmpty || isInitialLoading}
        emptyContent={emptyState}
        loading={isInitialLoading}
        emptyMessage={t('listings.jobs.empty')}
        onDownload={isEmpty || isInitialLoading ? undefined : onDownload}
        pagination={pagination}
        onRowClick={(row) => onJobClick(row.id)}
      />

      <ConfirmModal
        isOpen={Boolean(cancelTargetId)}
        onClose={onCancelDismiss}
        onConfirm={onCancelConfirm}
        type="warning"
        typeTitles={{
          info: t('translation:dialog.title.info'),
          success: t('translation:dialog.title.success'),
          warning: t('translation:dialog.title.warning'),
          error: t('translation:dialog.title.error'),
        }}
        description={t('listings.jobs.details.cancelConfirm')}
        confirmLabel={t('listings.jobs.details.cancelConfirmAction')}
        cancelLabel={t('translation:common.cancel')}
        isLoading={Boolean(cancellingJobId)}
      />
    </S.Container>
  );
};
