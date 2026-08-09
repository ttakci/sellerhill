import type { ListingJobItemDto } from '@repo/shared';
import {
  Button,
  DataTable,
  EmptyState,
  Icon,
  IdBadge,
  PageHeader,
  ProgressBar,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingJobDetailsPage.style';
import type { ListingJobDetailsPageComponentProps } from './ListingJobDetailsPage.types';

export const ListingJobDetailsPageComponent: React.FC<ListingJobDetailsPageComponentProps> = ({
  jobId,
  job,
  items,
  isLoading,
  isRefreshing,
  viewMode,
  onViewModeChange,
  columns,
  onBack,
  onRefresh,
  formatPercent,
  formatJobDate,
  jobStatusLabel,
  itemStatusLabel,
  itemFailureLabel,
  pagination,
  paginatedItems,
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

  const renderItemCard = (item: ListingJobItemDto) => (
    <S.ItemCard key={item.id} variant="elevated">
      <S.ItemCardHeader>
        <S.ItemIds>
          <IdBadge id={item.asin} storeType="amazon" size="sm" />
          {item.ebayItemId ? <IdBadge id={item.ebayItemId} storeType="ebay" size="sm" /> : null}
        </S.ItemIds>
        <StatusBadge status={String(item.status).toLowerCase()} size="sm">
          {itemStatusLabel(item.status)}
        </StatusBadge>
      </S.ItemCardHeader>
      {itemFailureLabel(item) ? <S.ErrorBox>{itemFailureLabel(item)}</S.ErrorBox> : null}
    </S.ItemCard>
  );

  const itemsEmpty = (
    <EmptyState
      icon={isLoading ? 'loader' : 'inventory'}
      title={
        isLoading
          ? t('translation:common.loading')
          : t('listings.jobs.items.emptyTitle')
      }
      description={
        isLoading
          ? t('listings.jobs.details.subtitle')
          : t('listings.jobs.items.emptySubtitle')
      }
      size="md"
    />
  );

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
          <S.SummaryTitleBlock>
            <S.SummaryTitleRow>
              <S.MonoId variant="body" weight="semibold" color="text.primary">
                {shortId}…
              </S.MonoId>
              {job ? (
                <StatusBadge status={String(job.status).toLowerCase()} size="sm">
                  {jobStatusLabel(job.status)}
                </StatusBadge>
              ) : null}
            </S.SummaryTitleRow>
            {job ? (
              <Text variant="caption" color="text.secondary">
                {formatJobDate(job.createdAt)}
              </Text>
            ) : null}
          </S.SummaryTitleBlock>
          <S.SummaryActions>
            <Button
              variant="secondary"
              size="small"
              onClick={onRefresh}
              isLoading={isRefreshing}
              disabled={isLoading || isRefreshing}
            >
              <Icon name="refresh" size={16} />
              <Text variant="body-sm">{t('listings.jobs.details.refresh')}</Text>
            </Button>
          </S.SummaryActions>
        </S.SummaryTop>

        {job ? (
          <>
            <S.ProgressBlock>
              <S.ProgressMeta>
                <Text variant="caption" color="text.secondary" weight="medium">
                  {job.processedCount}/{job.totalAsins}
                </Text>
                <Text variant="caption" weight="semibold" color="brand.primary">
                  {percent}%
                </Text>
              </S.ProgressMeta>
              <ProgressBar value={percent} size="sm" />
            </S.ProgressBlock>

            <S.MetricsInline>
              <S.MetricInline>
                <Text variant="caption" weight="semibold" color="text.primary">
                  {job.totalAsins}
                </Text>
                <Text variant="caption" color="text.tertiary">
                  {t('listings.jobs.table.total')}
                </Text>
              </S.MetricInline>
              <S.DotSep aria-hidden>·</S.DotSep>
              <S.MetricInline>
                <Text variant="caption" weight="semibold" color="semantic.success">
                  {job.successCount}
                </Text>
                <Text variant="caption" color="text.tertiary">
                  {t('listings.jobs.stats.success')}
                </Text>
              </S.MetricInline>
              <S.DotSep aria-hidden>·</S.DotSep>
              <S.MetricInline>
                <Text variant="caption" weight="semibold" color="semantic.error">
                  {job.failedCount}
                </Text>
                <Text variant="caption" color="text.tertiary">
                  {t('listings.jobs.stats.failed')}
                </Text>
              </S.MetricInline>
            </S.MetricsInline>
          </>
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

        <DataTable
          columns={columns}
          data={paginatedItems}
          renderGridCard={renderItemCard}
          viewMode={viewMode}
          onViewModeChange={onViewModeChange}
          defaultViewMode="grid"
          hideViewToggle={items.length === 0 && !isLoading}
          emptyContent={itemsEmpty}
          emptyMessage={t('listings.jobs.items.empty')}
          pagination={pagination}
        />
      </S.ItemsSection>
    </S.Container>
  );
};
