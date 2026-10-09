import type { EbayReturnDto, ReturnsQueryDto } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLazyGetReturnsQuery } from '../../api/returns.api';
import type { ReturnRowView } from '../../returns.types';

import { downloadCsv, fetchAllPages } from '@/utils/csv';

/** The API's own page-size ceiling (`RETURNS_MAX_PAGE_SIZE`), so an export makes as few calls as it can. */
const EXPORT_PAGE_SIZE = 100;

/**
 * "Export" on the returns page: every return the current tab, store, search
 * and sort select — not only the page on screen — as one CSV, in the order
 * and wording the table shows.
 */
export const useReturnsExport = (
  query: Omit<ReturnsQueryDto, 'page' | 'limit'>,
  toRow: (item: EbayReturnDto) => ReturnRowView
) => {
  const { t } = useTranslation(['returns', 'translation']);
  const { showMessage } = useUI();
  const [fetchReturns] = useLazyGetReturnsQuery();
  const [isExporting, setIsExporting] = useState(false);
  useLoading(isExporting);

  const exportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const items = await fetchAllPages(
        (page, limit) => fetchReturns({ ...query, page, limit }).unwrap(),
        EXPORT_PAGE_SIZE
      );
      const rows = items.map(toRow).map((row) => {
        const asin = row.productMeta.find((meta) => meta.storeType === 'amazon')?.id;
        const ebayId = row.productMeta.find((meta) => meta.storeType === 'ebay')?.id;
        return [
          row.returnId,
          row.ebayOrderId,
          t(`returns.bucket.${row.bucket}`),
          row.productTitle,
          asin,
          ebayId,
          row.reasonLabel,
          row.dueLabel,
          row.dueDate,
          row.refundLabel && row.refundAmount ? `${row.refundAmount} (${row.refundLabel})` : row.refundAmount,
          row.openedAt,
        ];
      });
      downloadCsv(
        'sellerhill_returns',
        [
          t('returns.columns.return'),
          t('returns.order'),
          t('returns.columns.status'),
          t('returns.columns.product'),
          t('returns.product.asin'),
          t('returns.product.ebayId'),
          t('returns.columns.reason'),
          t('returns.columns.due'),
          t('returns.columns.deadline'),
          t('returns.columns.refund'),
          t('returns.columns.opened'),
        ],
        rows
      );
    } catch {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'returns:returns.errors.exportFailed',
        },
        t
      );
    } finally {
      setIsExporting(false);
    }
  }, [fetchReturns, query, showMessage, t, toRow]);

  return { exportCsv, isExporting };
};
