import { ListingJobStatus, ListingStatus, type ListingJobItemDto } from '@repo/shared';
import { Badge, ConfirmModal, DataTable, EmptyState, PageHeader, SearchField, Select, Text } from '@repo/ui';
import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { CancelJobButton } from '../shared/CancelJobButton';
import { jobStatusBadgeVariant } from '../shared/job-status-badge';

import * as S from './ListingJobDetailsPage.style';
import type { ListingJobDetailsPageComponentProps } from './ListingJobDetailsPage.types';

import { ListingCard, type ListingCardMetaItem } from '@/domain-ui';

/** A label / value row — no icon; the label column is the only ornament. */
const jobMetaRow = (label: string, value: React.ReactNode): React.ReactElement => (
  <S.MetaRow>
    <S.MetaLabel>
      <Text variant="body-sm" color="text.secondary">
        {label}
      </Text>
    </S.MetaLabel>
    <S.MetaValue>{value}</S.MetaValue>
  </S.MetaRow>
);

export const ListingJobDetailsPageComponent: React.FC<ListingJobDetailsPageComponentProps> = ({
  jobId,
  job,
  items,
  isLoading,
  viewMode,
  onViewModeChange,
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
  onBack,
  onListingClick,
  canCancel,
  isCancelling,
  isCancelConfirmOpen,
  onCancelRequest,
  onCancelDismiss,
  onCancelConfirm,
  formatPercent,
  formatJobDate,
  jobStatusLabel,
  itemStatusLabel,
  itemFailureLabel,
  itemFailureReference,
  listingCardProps,
  pagination,
  paginatedItems,
  itemSearch,
  onItemSearchChange,
  onClearItemSearch,
  itemFilter,
  onItemFilterChange,
  itemFilterOptions,
  filteredItemCount,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  if (!isLoading && !job && items.length === 0) {
    return (
      <S.Container>
        <PageHeader
          title={t('listings.jobs.details.notFoundTitle')}
          subtitle={t('listings.jobs.details.notFoundSubtitle')}
          onBack={onBack}
          backAriaLabel={t('translation:common.back')}
        />
        <S.EmptyWrap>
          <EmptyState
            icon="clipboard-list"
            title={t('listings.jobs.details.notFoundTitle')}
            description={t('listings.jobs.details.notFoundSubtitle')}
            actionIcon="arrow-left"
            action={t('translation:common.back')}
            onAction={onBack}
            size="lg"
          />
        </S.EmptyWrap>
      </S.Container>
    );
  }

  const percent = job ? formatPercent(job) : 0;
  const isProcessing = job?.status === ListingJobStatus.PROCESSING;
  const progressTone = job
    ? job.successCount > 0
      ? 'positive'
      : job.status === ListingJobStatus.FAILED || (job.totalAsins > 0 && job.failedCount >= job.totalAsins)
        ? 'negative'
        : isProcessing
          ? 'active'
          : 'default'
    : 'default';

  const renderItemCard = (item: ListingJobItemDto) => {
    const listingId = item.listingId;

    // A completed item IS a listing — render the exact card the Listings
    // screen renders for it, with the job outcome as its top-left badge.
    if (item.listing) {
      return (
        <ListingCard
          key={item.id}
          {...listingCardProps(item.listing)}
          status={{ label: itemStatusLabel(item.status), tone: 'active' }}
          orientation="horizontal"
          onClick={() => onListingClick(item.listing?.id ?? listingId ?? '')}
        />
      );
    }

    const reason = itemFailureLabel(item);
    const reference = itemFailureReference(item);
    const meta: ListingCardMetaItem[] = [
      {
        label: t('listings.jobs.items.asin'),
        value: item.asin,
        storeType: 'amazon',
      },
    ];
    if (item.ebayItemId) {
      meta.push({
        label: t('listings.jobs.items.ebayId'),
        value: item.ebayItemId,
        storeType: 'ebay',
      });
    }
    if (reason) {
      meta.push({
        label: t('listings.jobs.items.reason'),
        value: reason,
        tone: 'negative',
        multiline: true,
      });
    }
    if (reference) {
      meta.push({
        label: t('listings.jobs.items.reference'),
        value: reference,
      });
    }

    const statusTone =
      item.status === ListingStatus.ERROR ? 'error' : item.status === ListingStatus.ACTIVE ? 'active' : 'neutral';

    return (
      <ListingCard
        key={item.id}
        title={item.productTitle || item.asin}
        imageUrl={item.imageUrls?.[0]}
        meta={meta}
        stats={[
          {
            label: t('listings.jobs.table.createdAt'),
            value: formatJobDate(item.createdAt),
          },
          {
            label: t('listings.jobs.table.updatedAt'),
            value: formatJobDate(item.updatedAt),
          },
        ]}
        status={{ label: itemStatusLabel(item.status), tone: statusTone }}
        orientation="horizontal"
        onClick={listingId ? () => onListingClick(listingId) : undefined}
        detailLabel={listingId ? t('translation:common.details') : undefined}
      />
    );
  };

  const hasActiveItemSearch = Boolean(itemSearch.trim());
  const isItemFilterEmpty = !isLoading && items.length > 0 && filteredItemCount === 0;

  const itemsEmpty = (() => {
    if (isLoading) {
      return (
        <EmptyState
          icon="loader"
          title={t('translation:common.loading')}
          description={t('listings.jobs.details.subtitle')}
          size="md"
        />
      );
    }
    if (isItemFilterEmpty) {
      return (
        <EmptyState
          icon="search"
          title={t('listings.empty.filtersTitle')}
          description={t('listings.empty.filtersSubtitle')}
          actionIcon="x"
          action={t('listings.empty.filtersAction')}
          onAction={onClearItemSearch}
          size="md"
        />
      );
    }
    return (
      <EmptyState
        icon="inventory"
        title={t('listings.jobs.items.emptyTitle')}
        description={t('listings.jobs.items.emptySubtitle')}
        size="md"
      />
    );
  })();

  return (
    <S.Container>
      <PageHeader
        title={t('listings.jobs.details.title')}
        subtitle={t('listings.jobs.details.subtitle')}
        onBack={onBack}
        backAriaLabel={t('translation:common.back')}
      />

      {job ? (
        <S.SummaryCard variant="elevated">
          <S.SummaryTop>
            <S.SummaryHeader>
              <Badge variant={jobStatusBadgeVariant(job.status)} size="sm" solid>
                {jobStatusLabel(job.status)}
              </Badge>
              {canCancel ? (
                <CancelJobButton
                  label={t('listings.jobs.details.cancel')}
                  onClick={onCancelRequest}
                  disabled={isCancelling}
                />
              ) : null}
            </S.SummaryHeader>
            <S.SummaryBody>
              <S.MetaList>
                {jobMetaRow(
                  t('listings.jobs.details.jobId'),
                  <S.MonoId variant="body-sm" weight="bold" color="text.primary">
                    {jobId}
                  </S.MonoId>
                )}
                {jobMetaRow(
                  t('listings.jobs.table.createdAt'),
                  <Text variant="body-sm" weight="bold" color="text.primary">
                    {formatJobDate(job.createdAt)}
                  </Text>
                )}
                {job.scheduledUntil
                  ? jobMetaRow(
                      t('listings.jobs.table.scheduledUntil'),
                      <Text variant="body-sm" weight="bold">
                        {formatJobDate(job.scheduledUntil)}
                      </Text>
                    )
                  : null}
                {jobMetaRow(
                  t('listings.jobs.table.processed'),
                  <Text variant="body-sm" weight="bold" color="text.primary" numeric>
                    {job.processedCount} / {job.totalAsins}
                  </Text>
                )}
              </S.MetaList>
              <S.MetaList>
                {jobMetaRow(
                  t('listings.jobs.stats.success'),
                  <S.StatValue variant="body-sm" weight="bold" $tone="positive" numeric>
                    {job.successCount}
                  </S.StatValue>
                )}
                {jobMetaRow(
                  t('listings.jobs.stats.failed'),
                  <S.StatValue variant="body-sm" weight="bold" $tone={job.failedCount > 0 ? 'negative' : 'default'} numeric>
                    {job.failedCount}
                  </S.StatValue>
                )}
                {jobMetaRow(
                  t('listings.jobs.stats.remaining'),
                  <S.StatValue variant="body-sm" weight="bold" numeric>
                    {Math.max(job.totalAsins - job.processedCount, 0)}
                  </S.StatValue>
                )}
              </S.MetaList>
              <S.ProgressSignal role="status" aria-label={t('listings.jobs.card.progressLabel', { percent })}>
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
            </S.SummaryBody>
          </S.SummaryTop>
        </S.SummaryCard>
      ) : null}

      <S.ItemsSection>
        {items.length > 0 || hasActiveItemSearch ? (
          <S.FilterBar>
            <S.SearchWrapper>
              <SearchField
                value={itemSearch}
                onChange={onItemSearchChange}
                placeholder={t('listings.jobs.items.searchPlaceholder')}
                size="small"
                fullWidth
              />
            </S.SearchWrapper>
            <S.SelectWrapper>
              <Select
                value={itemFilter}
                onChange={onItemFilterChange}
                options={itemFilterOptions}
                size="small"
                fullWidth
              />
            </S.SelectWrapper>
          </S.FilterBar>
        ) : null}

        <DataTable
          gridMinItemWidth="27rem"
          gridMaxColumns={2}
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
          resultLabel={
            <Trans
              i18nKey="listings.filters.resultListed"
              ns="listings"
              values={{ count: filteredItemCount }}
              components={{ b: <Text variant="body-sm" weight="bold" color="text.primary">{null}</Text> }}
            />
          }
          data={paginatedItems}
          renderGridCard={renderItemCard}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          defaultViewMode="grid"
          hideViewToggle={filteredItemCount === 0 && !isLoading}
          emptyContent={itemsEmpty}
          emptyMessage={t('listings.jobs.items.empty')}
          pagination={pagination}
          onRowClick={(item) => {
            if (item.listingId) {
              onListingClick(item.listingId);
            }
          }}
        />
      </S.ItemsSection>

      <ConfirmModal
        isOpen={isCancelConfirmOpen}
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
        isLoading={isCancelling}
      />
    </S.Container>
  );
};
