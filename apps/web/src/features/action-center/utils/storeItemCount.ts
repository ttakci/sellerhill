import type { ActionCenterSummaryDto } from '@repo/shared';

/**
 * How many waiting conditions belong to the store itself — the number the
 * top-bar store switcher shows beside each store. Account-wide items (plan,
 * setup, Amazon buyer accounts) appear in every store's summary, so counting
 * them would put the same number on every store.
 */
export const storeOwnItemCount = (summary: ActionCenterSummaryDto | undefined): number =>
  (summary?.groups ?? []).flatMap((group) => group.items).filter((item) => !item.accountWide).length;
