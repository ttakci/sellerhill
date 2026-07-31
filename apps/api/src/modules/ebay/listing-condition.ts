/**
 * Amazon title → eBay Inventory API condition enum.
 *
 * Kept deliberately conservative. `LIKE_NEW` (the previous mapping for
 * "Renewed") is only accepted in a handful of media categories, so it failed
 * the publish everywhere else; `SELLER_REFURBISHED` / `CERTIFIED_REFURBISHED`
 * require per-seller eligibility we cannot verify from here. `USED_EXCELLENT`
 * is accepted broadly and is the honest description of an Amazon Renewed unit.
 */
export enum EbayConditionEnum {
  NEW = 'NEW',
  NEW_OTHER = 'NEW_OTHER',
  USED_EXCELLENT = 'USED_EXCELLENT',
}

export function resolveEbayCondition(title: string): EbayConditionEnum {
  const lower = (title || '').toLowerCase();

  if (/\b(renewed|refurbished|refurb)\b/.test(lower)) {
    return EbayConditionEnum.USED_EXCELLENT;
  }
  if (/\bopen box\b/.test(lower)) {
    return EbayConditionEnum.NEW_OTHER;
  }
  return EbayConditionEnum.NEW;
}
