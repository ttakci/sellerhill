import type { ListingJobItemDto } from '@repo/shared';
import {
  Button,
  ConfirmModal,
  DataTable,
  EmptyState,
  Icon, type IconName,
  IdBadge,
  PageHeader,
  SearchField,
  SettingsCard,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { JobProgressRing } from '../shared/JobProgressRing';

import * as S from './ListingJobDetailsPage.style';
import type { ListingJobDetailsPageComponentProps } from './ListingJobDetailsPage.types';

const jobMetaRow = (
  icon: IconName,
  label: string,
  value: React.ReactNode
): React.ReactElement => (
  <S.MetaRow>
    <S.MetaLabel>
      <Icon name={icon} size={16} color="brand.primary" />
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
  onBack,
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
  pagination,
  paginatedItems,
  itemSearch,
  onItemSearchChange,
  onClearItemSearch,
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
            action={t('translation:common.back')}
            onAction={onBack}
            size="lg"
          />
        </S.EmptyWrap>
      </S.Container>
    );
  }

  const percent = job ? formatPercent(job) : 0;
  const shortId = jobId.slice(0, 8);

  const renderItemCard = (item: ListingJobItemDto) => {
    const reason = itemFailureLabel(item);
    const reference = itemFailureReference(item);

    return (
      <SettingsCard key={item.id} variant="section">
        <S.ItemCardHeader>
          <StatusBadge status={String(item.status).toLowerCase()} size="sm">
            {itemStatusLabel(item.status)}
          </StatusBadge>
        </S.ItemCardHeader>

        <S.MetaList>
          {jobMetaRow('barcode', t('listings.jobs.items.asin'), (
            <IdBadge id={item.asin} storeType="amazon" size="sm" />
          ))}
          {item.ebayItemId
            ? jobMetaRow('tag', t('listings.jobs.items.ebayId'), (
                <IdBadge id={item.ebayItemId} storeType="ebay" size="sm" />
              ))
            : null}
          {reason
            ? jobMetaRow('alert-triangle', t('listings.jobs.items.reason'), (
                <Text variant="body-sm" color="semantic.error">
                  {reason}
                </Text>
              ))
            : null}
          {reference
            ? jobMetaRow('file-text', t('listings.jobs.items.reference'), (
                <Text variant="caption" color="text.tertiary">
                  {reference}
                </Text>
              ))
            : null}
        </S.MetaList>
      </SettingsCard>
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

      <S.SummaryCard variant="elevated">
        <S.SummaryTop>
          <S.MonoId variant="body-sm" weight="semibold" color="text.secondary">
            {shortId}
          </S.MonoId>
          {job ? (
            <StatusBadge status={String(job.status).toLowerCase()} size="sm">
              {jobStatusLabel(job.status)}
            </StatusBadge>
          ) : null}
        </S.SummaryTop>

        {job ? (
          <>
            <S.ProgressRow>
              <S.ProgressMain>
                <JobProgressRing percent={percent} />
                <Text variant="body" weight="semibold" numeric>
                  {job.processedCount}/{job.totalAsins} ASIN
                </Text>
              </S.ProgressMain>
              <Text variant="caption" color="text.tertiary">
                {formatJobDate(job.createdAt)}
              </Text>
            </S.ProgressRow>

            <S.StatsGrid>
              <S.StatCell>
                <S.StatLabel variant="caption" color="text.tertiary">
                  {t('listings.jobs.table.total')}
                </S.StatLabel>
                <S.StatValue variant="body-sm" weight="bold" numeric>
                  {job.totalAsins}
                </S.StatValue>
              </S.StatCell>
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
            </S.StatsGrid>
          </>
        ) : null}

        {canCancel ? (
          <S.SummaryFooter>
            <Button
              variant="danger-tint"
              size="small"
              onClick={onCancelRequest}
              isLoading={isCancelling}
              disabled={isCancelling}
            >
              <Text variant="body-sm">{t('listings.jobs.details.cancel')}</Text>
            </Button>
          </S.SummaryFooter>
        ) : null}
      </S.SummaryCard>

      <S.ItemsSection>
        <S.SectionHeader>
          <Text variant="h4" weight="semibold">
            {t('listings.jobs.details.itemsTitle')}
          </Text>
          <Text variant="body-sm" color="text.secondary">
            {t('listings.jobs.details.itemsSubtitle', { count: items.length })}
          </Text>
        </S.SectionHeader>

        {items.length > 0 || hasActiveItemSearch ? (
          <S.FilterBar>
            <S.SearchWrapper>
              <SearchField
                value={itemSearch}
                onChange={onItemSearchChange}
                placeholder={t('listings.jobs.items.searchPlaceholder')}
                size="medium"
                fullWidth
              />
            </S.SearchWrapper>
            <S.FilterResultCount variant="caption" weight="medium" color="text.secondary">
              {t('listings.jobs.items.resultCount', { count: filteredItemCount })}
            </S.FilterResultCount>
          </S.FilterBar>
        ) : null}

        <DataTable
          columns={columns}
          data={paginatedItems}
          renderGridCard={renderItemCard}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          defaultViewMode="grid"
          hideViewToggle={filteredItemCount === 0 && !isLoading}
          emptyContent={itemsEmpty}
          emptyMessage={t('listings.jobs.items.empty')}
          pagination={pagination}
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
