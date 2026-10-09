import type { CancellationsQueryDto, EbayCancellationDto } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLazyGetCancellationsQuery } from '../../api/cancellations.api';
import type { CancellationRowView } from '../../cancellations.types';

import { downloadCsv, fetchAllPages } from '@/utils/csv';

/** The API's own page-size ceiling (the returns module's `RETURNS_MAX_PAGE_SIZE`, which the cancellations list shares), so an export makes as few calls as it can. */
const EXPORT_PAGE_SIZE = 100;

/**
 * "Export" on the cancellations page: every buyer cancel request the current tab, store, search
 * and sort select — not only the page on screen — as one CSV, in the order
 * and wording the table shows.
 */
export const useCancellationsExport = (
  query: Omit<CancellationsQueryDto, 'page' | 'limit'>,
  toRow: (item: EbayCancellationDto) => CancellationRowView
) => {
  const { t } = useTranslation(['cancellations', 'translation']);
  const { showMessage } = useUI();
  const [fetchCancellations] = useLazyGetCancellationsQuery();
  const [isExporting, setIsExporting] = useState(false);
  useLoading(isExporting);

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const items = await fetchAllPages(
        (page, limit) => fetchCancellations({ ...query, page, limit }).unwrap(),
        EXPORT_PAGE_SIZE
      );
      const rows = items.map(toRow).map((row) => {
        const asin = row.productMeta.find((meta) => meta.storeType === 'amazon')?.id;
        const ebayId = row.productMeta.find((meta) => meta.storeType === 'ebay')?.id;
        return [
          row.cancelId,
          row.ebayOrderId,
          row.bucketLabel,
          row.productTitle,
          asin,
          ebayId,
          row.buyerLoginName,
          row.reasonLabel,
          row.dueLabel,
          row.dueDate,
          row.refundAmount,
          row.requestedAt,
        ];
      });
      downloadCsv(
        'sellerhill_cancellations',
        [
          t('cancellations.columns.request'),
          t('cancellations.order'),
          t('cancellations.columns.status'),
          t('cancellations.columns.product'),
          t('cancellations.asin'),
          t('cancellations.ebayId'),
          t('cancellations.columns.buyer'),
          t('cancellations.columns.reason'),
          t('cancellations.columns.due'),
          t('cancellations.columns.deadline'),
          t('cancellations.columns.refund'),
          t('cancellations.columns.requested'),
        ],
        rows
      );
    } catch {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'cancellations:cancellations.errors.exportFailed',
        },
        t
      );
    } finally {
      setIsExporting(false);
    }
  }, [fetchCancellations, query, showMessage, t, toRow]);

  return { exportCsv, isExporting };
};
