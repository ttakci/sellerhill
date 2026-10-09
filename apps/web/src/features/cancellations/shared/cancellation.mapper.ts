import { CancellationBucket, type EbayCancellationDetailDto, type EbayCancellationDto } from '@repo/shared';
import { formatCurrency, formatDate } from '@repo/ui';

import type {
  CancellationDetailView,
  CancellationHistoryRowView,
  CancellationRowContext,
  CancellationRowView,
} from '../cancellations.types';

import {
  cancellationBucketPresentation,
  resolveCancellationReasonKey,
  resolveHistoryActivityKey,
  resolveHistoryActor,
  upcomingCancellationSteps,
} from './cancellation-presentation';

import type { ProductTableCellMetaRow } from '@/domain-ui';

const REQUESTED_FORMAT: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};
/** Journey steps carry seconds: eBay's own steps often land seconds apart (approve → refund → close). */
const STEP_FORMAT: Intl.DateTimeFormatOptions = { ...WHEN_FORMAT, second: '2-digit' };

/**
 * EbayCancellationDto → the strings the page renders. Money uses the currency
 * eBay reported on the request (falling back to the marketplace currency of
 * its store) — never the UI language.
 */
export function toCancellationRowView(item: EbayCancellationDto, ctx: CancellationRowContext): CancellationRowView {
  const { translate, locale, currencyFor } = ctx;
  const currency = item.currency ?? currencyFor(item.ebayAccountId);
  const presentation = cancellationBucketPresentation(item.bucket);

  // Only a request the seller still has to answer carries a deadline; a closed
  // or unconfirmed one shows nothing due.
  const answerDue = item.bucket === CancellationBucket.ACTION_DUE || item.bucket === CancellationBucket.ACTION_OVERDUE;
  const dueLabel = answerDue ? translate('cancellations.answer') : null;
  const dueDate = answerDue && item.sellerRespondBy ? formatDate(item.sellerRespondBy, locale, WHEN_FORMAT) : null;
  const dueBy = dueDate ? translate('cancellations.dueBy', { date: dueDate }) : null;

  const productMeta: ProductTableCellMetaRow[] = [];
  if (item.product?.asin) {
    productMeta.push({
      label: translate('cancellations.asin'),
      id: item.product.asin,
      storeType: 'amazon',
      icon: 'barcode',
    });
  }
  if (item.product?.ebayItemId) {
    productMeta.push({
      label: translate('cancellations.ebayId'),
      id: item.product.ebayItemId,
      storeType: 'ebay',
      icon: 'tag',
    });
  }

  const reasonKey = resolveCancellationReasonKey(item.reason);

  return {
    id: item.id,
    orderId: item.orderId,
    cancelId: item.cancelId,
    ebayOrderId: item.legacyOrderId,
    bucket: item.bucket,
    bucketLabel: translate(`cancellations.bucket.${item.bucket}`),
    bucketHint: translate(`cancellations.bucketHint.${item.bucket}`),
    bucketVariant: presentation.variant,
    bucketIcon: presentation.icon,
    productTitle: item.product?.title?.trim() || translate('cancellations.unknownProduct'),
    imageUrl: item.product?.imageUrl ?? undefined,
    productMeta,
    buyerLoginName: item.buyerLoginName,
    dueLabel,
    dueBy,
    dueDate,
    isOverdue: item.bucket === CancellationBucket.ACTION_OVERDUE,
    reasonLabel: translate(`cancellations.reason.${reasonKey}`),
    reasonRaw: reasonKey === 'other' ? item.reason : null,
    refundAmount:
      item.requestedRefundAmount === null ? null : formatCurrency(item.requestedRefundAmount, locale, currency, 2),
    requestedAt: item.requestedAt ? formatDate(item.requestedAt, locale, REQUESTED_FORMAT) : null,
  };
}

/**
 * EbayCancellationDetailDto → what the detail drawer renders. The list half
 * goes through `toCancellationRowView`, so the drawer and the card behind it
 * agree on the bucket, the deadline and the refund by construction.
 */
export function toCancellationDetailView(
  dto: EbayCancellationDetailDto,
  ctx: CancellationRowContext
): CancellationDetailView {
  const { translate, locale, currencyFor } = ctx;
  const currency = dto.currency ?? currencyFor(dto.ebayAccountId);
  const money = (value: number | null): string | null =>
    value === null ? null : formatCurrency(value, locale, currency, 2);
  const when = (value: string | null): string | null => (value ? formatDate(value, locale, WHEN_FORMAT) : null);

  const recorded: CancellationHistoryRowView[] = dto.history.map((entry, index) => {
    const actor = resolveHistoryActor(entry.party, entry.activity);
    return {
      id: `${index}-${entry.activity ?? 'step'}-${entry.at ?? ''}`,
      actor,
      label: translate(`cancellations.history.${resolveHistoryActivityKey(entry.activity, actor)}`),
      at: entry.at ? formatDate(entry.at, locale, STEP_FORMAT) : null,
      upcoming: false,
    };
  });
  const ahead: CancellationHistoryRowView[] = upcomingCancellationSteps(dto.history, dto.closedAt !== null).map(
    (step) => ({
      id: `upcoming-${step}`,
      actor: step === 'answer' ? 'seller' : 'ebay',
      label: translate(`cancellations.history.upcoming.${step}`),
      at: null,
      upcoming: true,
    })
  );
  const history = [...recorded, ...ahead];

  return {
    row: toCancellationRowView(dto, ctx),
    live: dto.live,
    actionsEnabled: dto.actionsEnabled,
    // A stored-only read offers nothing, whatever the stored row says.
    actions: dto.live ? dto.availableActions : [],
    ebayUrl: dto.ebayUrl,
    ebayOrderUrl: dto.ebayOrderUrl,
    requestedRefund: money(dto.requestedRefundAmount),
    actualRefund: money(dto.actualRefundAmount),
    amountOwed: money(dto.amountToRecoup),
    paymentStatus: dto.paymentStatus,
    closedAt: when(dto.closedAt),
    history,
  };
}
