// apps/api/src/modules/ebay-returns/return-detail-mapper.ts
//
// eBay `ReturnDetailType` (the `detail` container of
// `GET /post-order/v2/return/{returnId}`) → the row columns (the detail
// carries every summary field under the same names, so `mapReturnSummary`
// does that half) plus the live-only parts the detail pane shows: the
// history, the return shipments, eBay's option list, the eBay page URL.
//
// Pure and total, like `return-mapper.ts`: every field is optional in eBay's
// reference, enumerations are carried as sent, nothing throws.

import type { EbayReturnHistoryEntryDto, EbayReturnShipmentDto } from '@repo/shared';

import { EbayReturnRow, mapReturnSummary } from './return-mapper';

export interface MappedReturnDetail {
  row: EbayReturnRow;
  history: EbayReturnHistoryEntryDto[];
  shipments: EbayReturnShipmentDto[];
  /** `sellerAvailableOptions[].actionType`, as sent, de-duplicated, order kept. */
  options: string[];
  /** The first `sellerAvailableOptions[].actionURL` that is an https URL. */
  actionUrl: string | null;
  returnType: string | null;
  itemPrice: number | null;
  closeReason: string | null;
  closedAt: string | null;
}

type RawRecord = Record<string, unknown>;

const asRecord = (value: unknown): RawRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RawRecord) : null;

function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asIsoDate(value: unknown): string | null {
  const record = asRecord(value);
  const raw = record ? record.value : value;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return null;
  }
  const time = new Date(raw.trim()).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** Only an absolute https URL is ever handed to the browser as a link. */
function asHttpsUrl(value: unknown): string | null {
  const text = asText(value);
  if (!text) {
    return null;
  }
  try {
    const url = new URL(text);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapHistory(value: unknown): EbayReturnHistoryEntryDto[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const entries: EbayReturnHistoryEntryDto[] = [];
  for (const raw of value) {
    const entry = asRecord(raw);
    if (!entry) {
      continue;
    }
    const attributes = asRecord(entry.attributes);
    const partial = asRecord(attributes?.partialRefundAmount);
    entries.push({
      activity: asText(entry.activity),
      author: asText(entry.author),
      at: asIsoDate(entry.creationDate),
      fromState: asText(entry.fromState),
      toState: asText(entry.toState),
      notes: typeof entry.notes === 'string' && entry.notes.trim() !== '' ? entry.notes.trim() : null,
      partialRefundAmount: asNumber(partial?.value),
      trackingNumber: asText(attributes?.updatedTrackingNumber),
      rma: asText(attributes?.RMA),
    });
  }
  // Oldest first — eBay documents no order, and a timeline reads top-down.
  return entries.sort((a, b) => (a.at ?? '').localeCompare(b.at ?? ''));
}

function mapShipments(value: unknown): EbayReturnShipmentDto[] {
  const info = asRecord(value);
  const trackings = info?.allShipmentTrackings;
  if (!Array.isArray(trackings)) {
    return [];
  }
  const shipments: EbayReturnShipmentDto[] = [];
  for (const raw of trackings) {
    const tracking = asRecord(raw);
    if (!tracking) {
      continue;
    }
    shipments.push({
      trackingNumber: asText(tracking.trackingNumber),
      carrier: asText(tracking.carrierName) ?? asText(tracking.carrierUsed),
      shippedAt: asIsoDate(tracking.actualShipDate),
      deliveredAt: asIsoDate(tracking.actualDeliveryDate),
      deliveryStatus: asText(tracking.deliveryStatus),
      markedReceived: tracking.markAsReceived === true,
      labelId: asText(tracking.labelId),
    });
  }
  return shipments;
}

export function mapReturnDetail(detail: unknown): MappedReturnDetail | null {
  const row = mapReturnSummary(detail);
  const root = asRecord(detail);
  if (!row || !root) {
    return null;
  }

  const options: string[] = [];
  let actionUrl: string | null = null;
  if (Array.isArray(root.sellerAvailableOptions)) {
    for (const raw of root.sellerAvailableOptions) {
      const option = asRecord(raw);
      const actionType = asText(option?.actionType);
      if (actionType && !options.includes(actionType)) {
        options.push(actionType);
      }
      actionUrl ??= asHttpsUrl(option?.actionURL);
    }
  }

  const closeInfo = asRecord(root.closeInfo);
  const itemDetail = asRecord(root.itemDetail);
  const itemPrice = asRecord(itemDetail?.itemPrice);

  return {
    row,
    history: mapHistory(root.responseHistory),
    shipments: mapShipments(root.returnShipmentInfo),
    options,
    actionUrl,
    returnType: asText(root.currentType),
    itemPrice: asNumber(itemPrice?.value),
    closeReason: asText(closeInfo?.returnCloseReason),
    closedAt: asIsoDate(closeInfo?.returnCloseDate),
  };
}
