import {
  ListingFailureCode,
  ListingJobStatus,
  ListingRuleKind,
  ListingStatus,
  type ListingDto,
  type ListingJobDto,
  type ListingJobItemDto,
} from '@repo/shared';
import {
  StatusBadge,
  Text,
  formatCurrency,
  formatDate,
  getLocaleConfig,
  type TableColumn,
  type ViewMode,
} from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useListingsColumns } from '../../all/hooks/useListingsColumns';
import { useCancelListingJobMutation, useGetJobItemsQuery, useGetJobStatusQuery } from '../../api/listings.api';
import { toListingCardProps } from '../../shared/listing-card.mapper';

import { ListingJobDetailsPageComponent } from './ListingJobDetailsPage.component';
import * as S from './ListingJobDetailsPage.style';
import { JobItemFilter, type JobItemFilterOption } from './ListingJobDetailsPage.types';

import { ProductTableCell, type ProductTableCellMetaRow } from '@/domain-ui';
import { useFollowRecordStore } from '@/features/ebay/hooks/useFollowRecordStore';
import { useLocale } from '@/utils/useLocale';

const isFailedItem = (item: ListingJobItemDto): boolean => item.status === ListingStatus.ERROR;

/** The seller's own blacklist caused this failure — the one cause they can fix in Store Settings. */
const isBlacklistedItem = (item: ListingJobItemDto): boolean =>
  isFailedItem(item) &&
  (item.failureCode === ListingFailureCode.BLACKLISTED_KEYWORD ||
    // A listing rule (blocked ASIN, VeRO protection, price range, rating…) is
    // the same kind of refusal: the seller's own setting, not a failure.
    item.failureCode === ListingFailureCode.BLOCKED_BY_RULE);

const jobPercent = (job: ListingJobDto): number =>
  job.totalAsins > 0 ? Math.round((job.processedCount / job.totalAsins) * 100) : 0;

type JobItemSortKey = 'product' | 'status' | 'failureCode' | 'updatedAt';
const JOB_ITEM_SORT_KEYS: JobItemSortKey[] = ['product', 'status', 'failureCode', 'updatedAt'];

/**
 * The listings-table columns a job table carries, in the listings table's own
 * order — a completed row reads exactly like that listing's row under Listings.
 */
const LISTING_COLUMN_KEYS = [
  'category',
  'prices',
  'purchasePrice',
  'profit',
  'roi',
  'profitMargin',
  'sold',
  'quantity',
  'sourceStock',
];
/** Secondary listing figures start hidden so the reason column keeps its room; the column manager restores them. */
const DEFAULT_HIDDEN_COLUMN_KEYS = ['category', 'roi', 'profitMargin', 'sourceStock'];

export const ListingJobDetailsPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { jobId } = useParams<{ jobId: string }>();
  const { localeNavigate } = useLocale();
  const { locale } = getLocaleConfig(i18n.language);
  const { allColumns: listingColumns } = useListingsColumns(locale);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [itemSearch, setItemSearch] = useState('');
  const [itemFilter, setItemFilter] = useState<JobItemFilter>(JobItemFilter.ALL);
  const [sortBy, setSortBy] = useState<JobItemSortKey>('product');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const {
    data: job,
    isLoading: isJobLoading,
    refetch: refetchJob,
  } = useGetJobStatusQuery(jobId || '', {
    pollingInterval: 3000,
    skip: !jobId,
  });
  // A job of another store makes that store active (top bar).
  useFollowRecordStore(job?.ebayAccountId);

  const {
    data: items = [],
    isLoading: isItemsLoading,
    refetch: refetchItems,
  } = useGetJobItemsQuery(jobId || '', {
    pollingInterval: 3000,
    skip: !jobId,
  });

  const isLoading = (isJobLoading || isItemsLoading) && !job && items.length === 0;

  const [cancelJob, { isLoading: isCancelling }] = useCancelListingJobMutation();
  const [isCancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  /** Only a job that is still working can be stopped. */
  const canCancel = job?.status === ListingJobStatus.PENDING || job?.status === ListingJobStatus.PROCESSING;

  const jobStatusLabel = useCallback(
    (status: ListingJobStatus | string) => {
      const key = String(status).toLowerCase();
      const path = `listings.jobs.status.${key}`;
      const translated = t(path);
      return translated === path ? key : translated;
    },
    [t]
  );

  /**
   * Job-item statuses read differently from listing statuses.
   *
   * A job item starts at the `draft` default and only leaves it once the worker
   * reaches that ASIN, so labelling it "Draft" told sellers they had draft
   * listings that did not exist. Here `draft` means "queued". Falls back to the
   * listing vocabulary for anything the job namespace does not override.
   */
  const itemStatusLabel = useCallback(
    (status: ListingStatus | string) => {
      const key = String(status).toLowerCase();
      for (const path of [`listings.jobs.items.itemStatus.${key}`, `listings.status.${key}`]) {
        const translated = t(path);
        if (translated !== path) {
          return translated;
        }
      }
      return key;
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
      // A zero-stock failure gets the stock-aware message (with the actual
      // Amazon stock and buffer numbers) only when there IS a positive Amazon
      // stock number to show — `amazonStock === 0` means Amazon itself has
      // none, and "Amazon stock (0) is below your stock buffer (0)" would be
      // false (and confusing) when the buffer is also unset/0. Older rows
      // written before this detail existed, and the true "Amazon has zero"
      // case, both fall back to the plain zero_stock key.
      const d = item.failureDetails;
      // One of the seller's own listing rules: the message names the rule and,
      // where there is one, the product's figure beside the seller's limit.
      if (item.failureCode === ListingFailureCode.BLOCKED_BY_RULE) {
        const rule = d?.listingRule;
        const isPrice = rule === ListingRuleKind.PRICE_BELOW_MIN || rule === ListingRuleKind.PRICE_ABOVE_MAX;
        const figure = (value: number | null | undefined): string => {
          if (value === null || value === undefined) {
            return '';
          }
          // Amazon-sourced money is USD (only Amazon US exists).
          return isPrice ? formatCurrency(value, locale, 'USD', 2) : String(value);
        };
        const noRating = rule === ListingRuleKind.LOW_RATING && (d?.ruleActual === null || d?.ruleActual === undefined);
        const rulePath = `listings.jobs.failure.blocked_by_rule_${rule ?? ''}${noRating ? '_none' : ''}`;
        const ruleText = t(rulePath, {
          keyword: d?.blacklistedKeyword ?? '',
          actual: figure(d?.ruleActual),
          limit: figure(d?.ruleLimit),
        });
        return ruleText === rulePath ? t('listings.jobs.failure.blocked_by_rule') : ruleText;
      }
      const code =
        item.failureCode === ListingFailureCode.ZERO_STOCK && d?.amazonStock !== undefined && d.amazonStock > 0
          ? d.amazonStockAtLeast
            ? 'zero_stock_detail_at_least'
            : 'zero_stock_detail'
          : item.failureCode;
      const path = `listings.jobs.failure.${code}`;
      const translated = t(path, {
        aspects: (d?.aspectNames ?? []).join(', '),
        keyword: d?.blacklistedKeyword ?? '',
        stock: d?.amazonStock ?? '',
        buffer: d?.stockBuffer ?? '',
      });
      return translated === path ? null : translated;
    },
    [t, locale]
  );

  /**
   * Support reference for a failed item.
   *
   * The correlation id already threads through the API, the queue and the logs,
   * so a seller quoting it lets support find the exact attempt instead of
   * guessing from a timestamp and an ASIN.
   */
  const failureReference = useCallback(
    (item: ListingJobItemDto): string | null => item.failureDetails?.correlationId ?? null,
    []
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

  const allColumns: TableColumn<ListingJobItemDto>[] = useMemo(() => {
    const dash = (
      <Text variant="body-sm" color="text.tertiary">
        —
      </Text>
    );
    const listingColumn = (key: string) => listingColumns.find((column) => column.key === key);
    /**
     * A listings-table column, re-pointed at the listing a job item became.
     * Failed / queued items have no listing, so they read "—" — never a fake 0.
     * Not sortable here: the job sort runs over job-item fields only.
     */
    const fromListing = (key: string): TableColumn<ListingJobItemDto> | null => {
      const column = listingColumn(key);
      if (!column) {
        return null;
      }
      return {
        ...column,
        sortable: false,
        render: (_value, item, index) =>
          item.listing && column.render
            ? column.render((item.listing as unknown as Record<string, unknown>)[key], item.listing, index)
            : dash,
      };
    };
    const productListingColumn = listingColumn('product');

    const columns: (TableColumn<ListingJobItemDto> | null)[] = [
      {
        key: 'product',
        sortable: true,
        header: t('listings.table.product'),
        width: '20.5rem',
        render: (_value, item, index) => {
          // Same cell as the listings table once the item became a listing.
          if (item.listing && productListingColumn?.render) {
            return productListingColumn.render(item.listing.title, item.listing, index);
          }
          const meta: ProductTableCellMetaRow[] = [
            { label: t('listings.jobs.items.asin'), id: item.asin, storeType: 'amazon' },
          ];
          if (item.ebayItemId) {
            meta.push({
              label: t('listings.jobs.items.ebayId'),
              id: item.ebayItemId,
              storeType: 'ebay',
              icon: 'tag',
            });
          }
          return <ProductTableCell title={item.productTitle || item.asin} imageUrl={item.imageUrls?.[0]} meta={meta} />;
        },
      },
      {
        key: 'status',
        sortable: true,
        header: t('listings.jobs.items.status'),
        width: '8rem',
        render: (_value, item) => (
          <StatusBadge status={String(item.status).toLowerCase()} size="sm">
            {itemStatusLabel(item.status)}
          </StatusBadge>
        ),
      },
      ...LISTING_COLUMN_KEYS.map(fromListing),
      {
        key: 'failureCode',
        sortable: true,
        header: t('listings.jobs.items.reason'),
        width: '18rem',
        render: (_value, item) => {
          // Sellers see the localized, actionable reason only. The provider's
          // raw text (eBay error ids, SKUs, internal field names) is operator
          // diagnostics and is not sent to this surface at all.
          const reason = failureLabel(item);
          const reference = failureReference(item);
          if (!reason) {
            return dash;
          }
          return (
            <S.FailureCell>
              <Text variant="body-sm" color="semantic.error">
                {reason}
              </Text>
              {reference ? (
                <Text variant="caption" color="text.tertiary">
                  {t('listings.jobs.items.reference')}: {reference}
                </Text>
              ) : null}
            </S.FailureCell>
          );
        },
      },
      {
        key: 'updatedAt',
        sortable: true,
        header: t('listings.jobs.table.updatedAt'),
        width: '10rem',
        render: (_value, item) => (
          <Text variant="body-sm" color="text.secondary">
            {formatJobDate(item.updatedAt)}
          </Text>
        ),
      },
      // No per-item retry action. eBay's quota is metered per application and
      // shared by every seller, and a terminally failed item has already
      // exhausted the retries that could work (429/5xx at the HTTP layer, and
      // the aspect self-heal). Offering the button would spend a common
      // resource on the attempt least likely to succeed.
    ];
    return columns.filter((column): column is TableColumn<ListingJobItemDto> => Boolean(column));
  }, [t, listingColumns, itemStatusLabel, failureLabel, failureReference, formatJobDate]);

  const listingCardProps = useCallback((listing: ListingDto) => toListingCardProps(listing, t, locale), [t, locale]);

  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>(DEFAULT_HIDDEN_COLUMN_KEYS);
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
        .filter((column): column is TableColumn<ListingJobItemDto> => Boolean(column)),
    [allColumns, hiddenColumnKeys, orderedKeys]
  );
  const columnOptions = useMemo(
    () =>
      orderedKeys.map((key) => {
        const column = allColumns.find((candidate) => candidate.key === key);
        return {
          key,
          label: typeof column?.header === 'string' ? column.header : key,
          alwaysVisible: key === 'product',
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
      JOB_ITEM_SORT_KEYS.flatMap((key) => {
        const column = allColumns.find((candidate) => candidate.key === key);
        const label = typeof column?.header === 'string' ? column.header : key;
        return [
          { value: `${key}:asc`, label: `${label} ↑` },
          { value: `${key}:desc`, label: `${label} ↓` },
        ];
      }),
    [allColumns]
  );

  /** ASIN or the localized failure message — the two things a seller actually
      recognizes an item by. */
  const filterCounts = useMemo(
    () => ({
      failed: items.filter(isFailedItem).length,
      blacklisted: items.filter(isBlacklistedItem).length,
    }),
    [items]
  );

  /**
   * The blacklist split is offered only when the blacklist actually failed
   * something: with none, "non-blacklist failures" would be the same list as
   * "failed" and a dropdown of duplicates reads as a bug.
   */
  const itemFilterOptions: JobItemFilterOption[] = useMemo(() => {
    const options: JobItemFilterOption[] = [
      { value: JobItemFilter.ALL, label: t('listings.jobs.items.filterAll', { count: items.length }) },
      { value: JobItemFilter.FAILED, label: t('listings.jobs.items.filterFailed', { count: filterCounts.failed }) },
    ];
    if (filterCounts.blacklisted > 0) {
      options.push(
        {
          value: JobItemFilter.BLACKLISTED,
          label: t('listings.jobs.items.filterBlacklisted', { count: filterCounts.blacklisted }),
        },
        {
          value: JobItemFilter.NON_BLACKLISTED,
          label: t('listings.jobs.items.filterNonBlacklisted', {
            count: filterCounts.failed - filterCounts.blacklisted,
          }),
        }
      );
    }
    return options;
  }, [t, items.length, filterCounts]);

  const filteredItems = useMemo(() => {
    let byStatus = items;
    if (itemFilter === JobItemFilter.FAILED) {
      byStatus = items.filter(isFailedItem);
    } else if (itemFilter === JobItemFilter.BLACKLISTED) {
      byStatus = items.filter(isBlacklistedItem);
    } else if (itemFilter === JobItemFilter.NON_BLACKLISTED) {
      byStatus = items.filter((item) => isFailedItem(item) && !isBlacklistedItem(item));
    }
    const q = itemSearch.trim().toLowerCase();
    const searched = q
      ? byStatus.filter((item) => {
          if (
            item.asin.toLowerCase().includes(q) ||
            item.productTitle?.toLowerCase().includes(q) ||
            item.ebayItemId?.toLowerCase().includes(q)
          ) {
            return true;
          }
          const reason = failureLabel(item);
          return reason ? reason.toLowerCase().includes(q) : false;
        })
      : byStatus;
    const valueFor = (item: ListingJobItemDto): string => {
      if (sortBy === 'product') {
        return item.productTitle || item.asin;
      }
      if (sortBy === 'failureCode') {
        return failureLabel(item) ?? '';
      }
      return String(item[sortBy] ?? '');
    };
    return [...searched].sort((left, right) => {
      const comparison = valueFor(left).localeCompare(valueFor(right), locale, { numeric: true });
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [items, itemFilter, itemSearch, failureLabel, sortBy, sortDirection, locale]);

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page, rowsPerPage]);

  const handleItemSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setItemSearch(e.target.value);
    setPage(1);
  }, []);

  const handleItemFilterChange = useCallback((value: string | number) => {
    // Select hands back a plain value; anything that is not a known filter
    // (a stale option after the counts changed) falls back to "all".
    const next = Object.values(JobItemFilter).find((filter) => filter === value);
    setItemFilter(next ?? JobItemFilter.ALL);
    setPage(1);
  }, []);

  const handleClearItemSearch = useCallback(() => {
    setItemSearch('');
    setItemFilter(JobItemFilter.ALL);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((value: string | number) => {
    const [nextKey, nextDirection] = String(value).split(':');
    if (!JOB_ITEM_SORT_KEYS.includes(nextKey as JobItemSortKey)) {
      return;
    }
    setSortBy(nextKey as JobItemSortKey);
    setSortDirection(nextDirection === 'desc' ? 'desc' : 'asc');
    setPage(1);
  }, []);
  const handleColumnSort = useCallback(
    (columnKey: string) => {
      if (!JOB_ITEM_SORT_KEYS.includes(columnKey as JobItemSortKey)) {
        return;
      }
      setSortBy(columnKey as JobItemSortKey);
      setSortDirection((current) => (sortBy === columnKey && current === 'asc' ? 'desc' : 'asc'));
      setPage(1);
    },
    [sortBy]
  );

  const handleBack = useCallback(() => {
    localeNavigate('/listings/jobs');
  }, [localeNavigate]);

  const handleListingClick = useCallback(
    (listingId: string) => {
      localeNavigate(`/listings/${listingId}`);
    },
    [localeNavigate]
  );

  const handleCancelConfirm = useCallback(async () => {
    if (!jobId) {
      return;
    }
    try {
      await cancelJob(jobId).unwrap();
    } finally {
      // Close regardless: on success the poll already shows the new state, and
      // on failure leaving the dialog open would hide the reason behind it.
      setCancelConfirmOpen(false);
      void refetchJob();
      void refetchItems();
    }
  }, [jobId, cancelJob, refetchJob, refetchItems]);

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
      viewMode={viewMode}
      onViewModeChange={setViewMode}
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
      onBack={handleBack}
      onListingClick={handleListingClick}
      canCancel={canCancel}
      isCancelling={isCancelling}
      isCancelConfirmOpen={isCancelConfirmOpen}
      onCancelRequest={() => setCancelConfirmOpen(true)}
      onCancelDismiss={() => setCancelConfirmOpen(false)}
      onCancelConfirm={() => void handleCancelConfirm()}
      formatPercent={jobPercent}
      formatJobDate={formatJobDate}
      jobStatusLabel={jobStatusLabel}
      itemStatusLabel={itemStatusLabel}
      itemFailureLabel={failureLabel}
      itemFailureReference={failureReference}
      listingCardProps={listingCardProps}
      itemSearch={itemSearch}
      onItemSearchChange={handleItemSearchChange}
      onClearItemSearch={handleClearItemSearch}
      itemFilter={itemFilter}
      onItemFilterChange={handleItemFilterChange}
      itemFilterOptions={itemFilterOptions}
      filteredItemCount={filteredItems.length}
      pagination={{
        count: filteredItems.length,
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
