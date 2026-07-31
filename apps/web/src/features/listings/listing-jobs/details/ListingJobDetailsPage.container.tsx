import {
  ListingJobStatus,
  ListingStatus,
  isRetryableListingFailure,
  type ListingJobDto,
  type ListingJobItemDto,
} from '@repo/shared';
import {
  Button,
  IdBadge,
  StatusBadge,
  Text,
  useUI,
  formatDate,
  getLocaleConfig,
  type TableColumn,
  type ViewMode,
} from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import {
  useGetJobItemsQuery,
  useGetJobStatusQuery,
  useRetryJobItemMutation,
} from '../../api/listings.api';

import { ListingJobDetailsPageComponent } from './ListingJobDetailsPage.component';
import * as S from './ListingJobDetailsPage.style';

import { useLocale } from '@/utils/useLocale';

const jobPercent = (job: ListingJobDto): number =>
  job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;

export const ListingJobDetailsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { jobId } = useParams<{ jobId: string }>();
  const { localeNavigate } = useLocale();
  const { locale } = getLocaleConfig(i18n.language);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);

  const {
    data: job,
    isLoading: isJobLoading,
    isFetching: isJobFetching,
    refetch: refetchJob,
  } = useGetJobStatusQuery(jobId || '', {
    pollingInterval: 3000,
    skip: !jobId,
  });

  const {
    data: items = [],
    isLoading: isItemsLoading,
    isFetching: isItemsFetching,
    refetch: refetchItems,
  } = useGetJobItemsQuery(jobId || '', {
    pollingInterval: 3000,
    skip: !jobId,
  });

  const [retryJobItem, { isLoading: isRetrying }] = useRetryJobItemMutation();
  const { showMessage, closeMessage } = useUI();

  const isLoading = (isJobLoading || isItemsLoading) && !job && items.length === 0;
  const isRefreshing = isJobFetching || isItemsFetching;

  const jobStatusLabel = useCallback(
    (status: ListingJobStatus | string) => {
      const key = String(status).toLowerCase();
      const path = `listings.jobs.status.${key}`;
      const translated = t(path);
      return translated === path ? key : translated;
    },
    [t]
  );

  const itemStatusLabel = useCallback(
    (status: ListingStatus | string) => {
      const key = String(status).toLowerCase();
      const path = `listings.status.${key}`;
      const translated = t(path);
      return translated === path ? key : translated;
    },
    [t]
  );

  /**
   * Localized reason for a failed item. The raw eBay string is technical detail,
   * not an explanation — before the failure taxonomy it was all the seller got.
   */
  const failureLabel = useCallback(
    (item: ListingJobItemDto): string | null => {
      if (!item.failureCode) {
        return null;
      }
      const path = `listings.jobs.failure.${item.failureCode}`;
      const translated = t(path, {
        aspects: (item.failureDetails?.aspectNames ?? []).join(', '),
      });
      return translated === path ? null : translated;
    },
    [t]
  );

  const handleRetryItem = useCallback(
    async (item: ListingJobItemDto) => {
      if (!jobId) {
        return;
      }
      try {
        await retryJobItem({ jobId, itemId: item.id }).unwrap();
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:message.success.header',
            descriptionKey: 'listings:listings.jobs.items.retryQueued',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      } catch {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: 'listings:listings.jobs.items.retryFailed',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t
        );
      }
    },
    [jobId, retryJobItem, showMessage, closeMessage, t]
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

  const columns: TableColumn<ListingJobItemDto>[] = useMemo(
    () => [
      {
        key: 'asin',
        header: t('listings.jobs.items.asin'),
        render: (_value, item) => <IdBadge id={item.asin} storeType="amazon" size="sm" />,
      },
      {
        key: 'status',
        header: t('listings.jobs.items.status'),
        render: (_value, item) => (
          <StatusBadge status={String(item.status).toLowerCase()} size="sm">
            {itemStatusLabel(item.status)}
          </StatusBadge>
        ),
      },
      {
        key: 'ebayItemId',
        header: t('listings.jobs.items.ebayId'),
        render: (_value, item) =>
          item.ebayItemId ? (
            <IdBadge id={item.ebayItemId} storeType="ebay" size="sm" />
          ) : (
            <Text variant="body-sm" color="text.tertiary">
              —
            </Text>
          ),
      },
      {
        key: 'errorMessage',
        header: t('listings.jobs.items.reason'),
        render: (_value, item) => {
          const reason = failureLabel(item);
          if (!reason && !item.errorMessage) {
            return (
              <Text variant="body-sm" color="text.tertiary">
                —
              </Text>
            );
          }
          return (
            <S.FailureCell>
              <Text variant="body-sm">{reason ?? item.errorMessage}</Text>
              {item.errorMessage && reason ? (
                <S.TechnicalDetails>
                  <summary>
                    <Text variant="caption" color="text.secondary">
                      {t('listings.jobs.items.technicalDetails')}
                    </Text>
                  </summary>
                  <S.ErrorBox>{item.errorMessage}</S.ErrorBox>
                </S.TechnicalDetails>
              ) : null}
            </S.FailureCell>
          );
        },
      },
      {
        key: 'retry',
        header: '',
        render: (_value, item) =>
          item.status === ListingStatus.ERROR && isRetryableListingFailure(item.failureCode) ? (
            <Button size="small" variant="secondary" isLoading={isRetrying} onClick={() => void handleRetryItem(item)}>
              <Text variant="body-sm">{t('listings.jobs.items.retry')}</Text>
            </Button>
          ) : null,
      },
    ],
    [t, itemStatusLabel, failureLabel, handleRetryItem, isRetrying]
  );

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return items.slice(start, start + rowsPerPage);
  }, [items, page, rowsPerPage]);

  const handleBack = useCallback(() => {
    localeNavigate('/listings/jobs');
  }, [localeNavigate]);

  const handleRefresh = useCallback(() => {
    void refetchJob();
    void refetchItems();
  }, [refetchJob, refetchItems]);

  if (!jobId) {
    return null;
  }

  return (
    <ListingJobDetailsPageComponent
      jobId={jobId}
      job={job}
      items={items}
      paginatedItems={paginatedItems}
      isLoading={isLoading}
      isRefreshing={isRefreshing}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      columns={columns}
      onBack={handleBack}
      onRefresh={handleRefresh}
      formatPercent={jobPercent}
      formatJobDate={formatJobDate}
      jobStatusLabel={jobStatusLabel}
      itemStatusLabel={itemStatusLabel}
      pagination={{
        count: items.length,
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
  );
};
