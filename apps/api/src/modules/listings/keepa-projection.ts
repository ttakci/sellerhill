import {
  fairSplitTokens,
  KeepaUsageSource,
  UsageEventSource,
  UsageMetric,
  type UsageEventParams,
} from '@repo/shared';

/**
 * Pure helper: build the `usage_events` projection rows for a single
 * `keepa_usage_log` source row. Deterministic fair-share across the users
 * sharing the ASIN — per-user shares sum to exactly `tokens` (no token lost or
 * double-counted). When no users are provided, a single platform-level event
 * (userId = null) carries the full token count.
 *
 * Keepa token pricing is not yet defined in `llm_model_pricing`, so cost is
 * always NULL in this iteration (the plan: "Keepa fiyatı henüz tanımlı değilse
 * estimated cost NULL kalır"). The seam is typed so a future pricing row can be
 * wired in without changing the projection shape.
 */
export function buildKeepaUsageEvents(args: {
  sourceLogId: string;
  tokens: number;
  keepaSource: KeepaUsageSource;
  asin: string;
  userIds: string[];
  occurredAt?: Date;
}): UsageEventParams[] {
  const { sourceLogId, tokens, keepaSource, asin, userIds, occurredAt } = args;

  if (!Number.isFinite(tokens) || tokens <= 0) {
    return [];
  }

  const metadata = { asin, keepaSource };
  const recordedAt = occurredAt ?? new Date();

  const allocations = fairSplitTokens(tokens, userIds);
  if (allocations.length === 0) {
    return [
      {
        source: UsageEventSource.KEEPA,
        metric: UsageMetric.KEEPA_TOKENS,
        providerRefId: sourceLogId,
        userId: null,
        quantity: tokens,
        estimatedCostMicros: null,
        currency: null,
        recordedAt,
        metadata,
      },
    ];
  }

  return allocations.map((alloc) => ({
    source: UsageEventSource.KEEPA,
    metric: UsageMetric.KEEPA_TOKENS,
    providerRefId: sourceLogId,
    userId: alloc.userId,
    quantity: alloc.tokens,
    estimatedCostMicros: null,
    currency: null,
    recordedAt,
    metadata,
  }));
}
