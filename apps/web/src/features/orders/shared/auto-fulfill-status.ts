import { AutoFulfillStatus } from '@repo/shared';
import type { BadgeVariant } from '@repo/ui';

/**
 * Map an order's automated-fulfillment lifecycle state to a Badge variant
 * for the orders list + detail chips. Pure derivation (presentation concern),
 * but kept here — not in a `.component.tsx` — so variant choice is centralized
 * alongside the i18n key resolution in `useOrdersColumns`/detail containers.
 *
 * Variant policy (per task 11 brief):
 * - placed   -> success  (Amazon order placed, costs captured)
 * - running  -> info     (checkout in progress)
 * - blocked  -> warning  (fail-closed obstacle — surface for manual fallback)
 * - failed   -> error    (unexpected transport/infra failure)
 * - dry_run  -> neutral  (walked the flow without placing)
 * - pending  -> secondary (queued / not yet attempted)
 * - skipped  -> secondary (ineligible / auto off)
 */
export const autoFulfillStatusToBadgeVariant = (
  status: AutoFulfillStatus | undefined | null,
): BadgeVariant => {
  if (!status) {
    return 'secondary';
  }
  const map: Record<AutoFulfillStatus, BadgeVariant> = {
    [AutoFulfillStatus.PLACED]: 'success',
    [AutoFulfillStatus.RUNNING]: 'info',
    [AutoFulfillStatus.BLOCKED]: 'warning',
    [AutoFulfillStatus.FAILED]: 'error',
    [AutoFulfillStatus.DRY_RUN]: 'neutral',
    [AutoFulfillStatus.PENDING]: 'secondary',
    [AutoFulfillStatus.SKIPPED]: 'secondary',
  };
  return map[status] ?? 'secondary';
};

/**
 * Whether a given status should drive the "needs attention" filter
 * (blocked or failed — both require operator intervention to recover).
 */
export const isAutoFulfillNeedsAttention = (
  status: AutoFulfillStatus | undefined | null,
): boolean =>
  status === AutoFulfillStatus.BLOCKED ||
  status === AutoFulfillStatus.FAILED;
