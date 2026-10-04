// apps/api/src/modules/ebay-finances/billing-capture.helpers.ts

import { BILLING_MAX_WINDOW_DAYS } from './ebay-finances.constants';
import type { BillingPage } from './ebay-finances.types';

const MS_PER_DAY = 86_400_000;

/** `transactionDate:[start..end]` in UTC, at most 120 days back (eBay's documented bound). */
export function buildBillingDateFilter(now: Date, windowDays: number): string {
  const days = Math.min(Math.max(Math.floor(Number.isFinite(windowDays) ? windowDays : 1), 1), BILLING_MAX_WINDOW_DAYS);
  const start = new Date(now.getTime() - days * MS_PER_DAY);
  return `transactionDate:[${start.toISOString()}..${now.toISOString()}]`;
}

/**
 * The paging facts of one response, or null when the body is not the
 * documented object. Nothing here interprets a billing line: the parser is
 * written later, against the captured files (spec Part E).
 */
export function readBillingPage(body: unknown): BillingPage | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const activities: unknown[] = Array.isArray(record.billingActivities) ? record.billingActivities : [];
  const total = typeof record.total === 'number' && Number.isFinite(record.total) ? record.total : null;
  const feeTypes = activities
    .map((activity) =>
      activity && typeof activity === 'object' ? (activity as Record<string, unknown>).feeType : undefined
    )
    .filter((type): type is string => typeof type === 'string');
  return {
    count: activities.length,
    total,
    hasNext: typeof record.next === 'string' && record.next !== '',
    feeTypes,
  };
}

/** "A×2, B×1" — the one fact the capture is for (which feeType is the ad fee), readable in the log. */
export function summarizeFeeTypes(pages: readonly BillingPage[]): string {
  const counts = new Map<string, number>();
  for (const page of pages) {
    for (const type of page.feeTypes) {
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
  }
  return (
    [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => `${type}×${count}`)
      .join(', ') || 'none'
  );
}
