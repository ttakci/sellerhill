import { ReturnBucket, type EbayReturnDto } from '@repo/shared';
import { formatCurrency, formatDate } from '@repo/ui';

import type { ReturnRowContext, ReturnRowView } from '../returns.types';

import { resolveReasonTypeKey, resolveSellerActivityKey } from './return-presentation';

import type { ProductTableCellMetaRow } from '@/domain-ui';

const OPENED_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const DEADLINE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

/**
 * EbayReturnDto → the strings the page renders.
 *
 * Money uses the currency eBay reported on the return (falling back to the
 * marketplace currency of its store) — never the UI language.
 */
export function toReturnRowView(item: EbayReturnDto, ctx: ReturnRowContext): ReturnRowView {
  const { translate, locale, currencyFor, storeLabelFor } = ctx;
  const currency = item.currency ?? currencyFor(item.ebayAccountId);

  // A closed return has nothing due, whatever the last `sellerResponseDue` said;
  // and on a return eBay has not confirmed recently, the last action and its
  // deadline are old news — showing them would state them as current.
  const showsDue = item.bucket !== ReturnBucket.CLOSED && item.bucket !== ReturnBucket.UNCONFIRMED;
  const activityKey = showsDue ? resolveSellerActivityKey(item.sellerActivityDue) : null;
  const dueLabel = activityKey ? translate(`returns.activity.${activityKey}`) : null;
  const dueBy =
    dueLabel && item.sellerRespondBy
      ? translate('returns.dueBy', { date: formatDate(item.sellerRespondBy, locale, DEADLINE_FORMAT) })
      : null;

  const refunded = item.actualRefundAmount !== null && item.actualRefundAmount !== undefined;
  const refundValue = refunded ? item.actualRefundAmount : item.estimatedRefundAmount;
  const hasRefund = refundValue !== null && refundValue !== undefined;

  const productMeta: ProductTableCellMetaRow[] = [];
  if (item.product?.asin) {
    productMeta.push({
      label: translate('returns.product.asin'),
      id: item.product.asin,
      storeType: 'amazon',
      icon: 'barcode',
    });
  }
  if (item.ebayItemId) {
    productMeta.push({
      label: translate('returns.product.ebayId'),
      id: item.ebayItemId,
      storeType: 'ebay',
      icon: 'tag',
    });
  }

  const title = item.product?.title?.trim();

  return {
    id: item.id,
    orderId: item.orderId,
    returnId: item.returnId,
    ebayOrderId: item.ebayOrderId,
    bucket: item.bucket,
    productTitle: title || translate('returns.unknownProduct'),
    imageUrl: item.product?.imageUrl ?? undefined,
    productMeta,
    dueLabel,
    dueBy,
    isOverdue: item.bucket === ReturnBucket.ACTION_OVERDUE,
    reasonLabel: translate(`returns.reasonType.${resolveReasonTypeKey(item.reasonType)}`),
    buyerComment: item.buyerComment?.trim() || null,
    refundAmount: hasRefund ? formatCurrency(refundValue, locale, currency) : null,
    refundLabel: hasRefund ? translate(refunded ? 'returns.refund.refunded' : 'returns.refund.estimated') : null,
    openedAt: item.createdOnEbayAt ? formatDate(item.createdOnEbayAt, locale, OPENED_FORMAT) : null,
    storeLabel: storeLabelFor ? storeLabelFor(item.ebayAccountId) : null,
  };
}
