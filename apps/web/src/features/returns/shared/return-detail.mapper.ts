import { EbayReturnAction, type EbayReturnDetailDto } from '@repo/shared';
import { formatCurrency, formatDate } from '@repo/ui';

import type { ReturnDetailView, ReturnHistoryRowView, ReturnRowContext, ReturnShipmentRowView } from '../returns.types';

import {
  resolveCloseReasonKey,
  resolveHistoryActivityKey,
  resolveHistoryActor,
  resolveReturnTypeKey,
} from './return-presentation';
import { toReturnRowView } from './return-row.mapper';

const WHEN_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

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
    actionsEnabled: dto.actionsEnabled,
    actions: dto.availableActions,
    refundToIssue: dto.availableActions.includes(EbayReturnAction.ISSUE_REFUND) ? money(dto.estimatedRefundAmount) : null,
    ebayUrl: dto.ebayUrl,
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
