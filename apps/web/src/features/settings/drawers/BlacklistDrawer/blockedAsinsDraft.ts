import { parseBlockedAsins } from '@repo/shared';

import type { BlockedAsinsDraft } from './BlacklistDrawer.types';

/**
 * What the blocked-ASIN card starts from. A store with no list of its own
 * (`null` — inherit) shows the global list it is running on, marked so the
 * seller knows; an empty list of its own (`[]`) is a choice and shows empty.
 */
export const blockedAsinsDraft = (
  scopeList: readonly string[] | null | undefined,
  globalList: readonly string[] | null | undefined,
  isGlobal: boolean
): BlockedAsinsDraft => {
  if (isGlobal || Array.isArray(scopeList)) {
    return { text: (scopeList ?? []).join('\n'), inherited: false };
  }
  return { text: (globalList ?? []).join('\n'), inherited: true };
};

/**
 * What the save sends: `undefined` (leave unchanged — an inherited list stays
 * inherited) when the seller did not touch the text, else the cleaned list.
 */
export const toSaveBlockedAsins = (text: string, original: BlockedAsinsDraft): string[] | undefined =>
  text === original.text ? undefined : parseBlockedAsins(text);
