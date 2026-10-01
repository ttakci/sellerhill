import { EbayReturnAction, RETURN_ACTION_EBAY_OPTION, type EbayReturnDetailDto } from '@repo/shared';
import { formatCurrency, formatDate } from '@repo/ui';

import type { ReturnDetailView, ReturnHistoryRowView, ReturnRowContext, ReturnShipmentRowView } from '../returns.types';

import {
  resolveCloseReasonKey,
  resolveHistoryActivityKey,
  resolveHistoryActor,
  resolveReturnTypeKey,
  resolveSellerActivityKey,
} from './return-presentation';
import { toReturnRowView } from './return-row.mapper';

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const IN_APP_OPTIONS: readonly string[] = Object.values(RETURN_ACTION_EBAY_OPTION);

/** eBay delivery statuses with a localized label; anything else prints nothing rather than a raw enum. */
const DELIVERY_STATUSES: readonly string[] = ['DELIVERED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'NOT_SHIPPED', 'SHIPPED'];

/**
 * EbayReturnDetailDto → what the detail drawer renders. The list half goes
 * through `toReturnRowView`, so the drawer and the row behind it agree on the
 * bucket, the deadline and the refund by construction.
 */
export function toReturnDetailView(dto: EbayReturnDetailDto, ctx: ReturnRowContext): ReturnDetailView {
  const { translate, locale, currencyFor } = ctx;
  const currency = dto.currency ?? currencyFor(dto.ebayAccountId);
  const money = (value: number | null): string | null => (value === null ? null : formatCurrency(value, locale, currency, 2));
  const when = (value: string | null): string | null => (value ? formatDate(value, locale, WHEN_FORMAT) : null);

  const row = toReturnRowView(dto, ctx);

  // What eBay lists that the app does not do itself — the seller does those on
  // eBay. Localized with the same imperative wording the "what is due" column
  // uses; an undocumented option reads as the generic "respond on eBay".
  const optionsOnEbay = Array.from(
    new Set(
      dto.ebayOptions
        .filter((option) => !IN_APP_OPTIONS.includes(option))
        .map((option) => translate(`returns.activity.${resolveSellerActivityKey(option) ?? 'other'}`))
    )
  );

  const history: ReturnHistoryRowView[] = dto.history.map((entry, index) => ({
    id: `${entry.activity ?? 'step'}-${entry.at ?? index}`,
    actor: resolveHistoryActor(entry.activity),
    label: translate(`returns.history.${resolveHistoryActivityKey(entry.activity)}`),
    author: entry.author,
    at: when(entry.at),
    notes: entry.notes,
    partialRefund: money(entry.partialRefundAmount),
    trackingNumber: entry.trackingNumber,
    rma: entry.rma,
  }));

  const shipments: ReturnShipmentRowView[] = dto.shipments.map((shipment, index) => ({
    id: shipment.trackingNumber ?? shipment.labelId ?? String(index),
    trackingNumber: shipment.trackingNumber,
    carrier: shipment.carrier,
    shippedAt: when(shipment.shippedAt),
    deliveredAt: when(shipment.deliveredAt),
    statusLabel:
      shipment.deliveryStatus && DELIVERY_STATUSES.includes(shipment.deliveryStatus)
        ? translate(`returns.deliveryStatus.${shipment.deliveryStatus}`)
        : null,
    markedReceived: shipment.markedReceived,
  }));

  const returnTypeKey = resolveReturnTypeKey(dto.returnType);
  const closed = dto.closedAt !== null || dto.closeReason !== null;

  return {
    row,
    live: dto.live,
    actions: dto.availableActions,
    refundToIssue: dto.availableActions.includes(EbayReturnAction.ISSUE_REFUND) ? money(dto.estimatedRefundAmount) : null,
    ebayUrl: dto.ebayUrl,
    optionsOnEbay,
    buyerLoginName: dto.buyerLoginName,
    quantity: dto.returnQuantity,
    returnTypeLabel: returnTypeKey ? translate(`returns.returnType.${returnTypeKey}`) : null,
    itemPrice: money(dto.itemPrice),
    estimatedRefund: money(dto.estimatedRefundAmount),
    actualRefund: money(dto.actualRefundAmount),
    closeReasonLabel: closed ? translate(`returns.closeReason.${resolveCloseReasonKey(dto.closeReason)}`) : null,
    closedAt: when(dto.closedAt),
    history,
    shipments,
  };
}
