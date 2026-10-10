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
  LIKE_NEW = 'LIKE_NEW',
  NEW_OTHER = 'NEW_OTHER',
  NEW_WITH_DEFECTS = 'NEW_WITH_DEFECTS',
  CERTIFIED_REFURBISHED = 'CERTIFIED_REFURBISHED',
  EXCELLENT_REFURBISHED = 'EXCELLENT_REFURBISHED',
  VERY_GOOD_REFURBISHED = 'VERY_GOOD_REFURBISHED',
  GOOD_REFURBISHED = 'GOOD_REFURBISHED',
  SELLER_REFURBISHED = 'SELLER_REFURBISHED',
  USED_EXCELLENT = 'USED_EXCELLENT',
  USED_VERY_GOOD = 'USED_VERY_GOOD',
  USED_GOOD = 'USED_GOOD',
  USED_ACCEPTABLE = 'USED_ACCEPTABLE',
  FOR_PARTS_OR_NOT_WORKING = 'FOR_PARTS_OR_NOT_WORKING',
}

/** Inventory API condition enum ↔ eBay's numeric condition id (Sell Metadata API speaks ids). */
export const EBAY_CONDITION_ID: Record<EbayConditionEnum, string> = {
  [EbayConditionEnum.NEW]: '1000',
  [EbayConditionEnum.LIKE_NEW]: '2750',
  [EbayConditionEnum.NEW_OTHER]: '1500',
  [EbayConditionEnum.NEW_WITH_DEFECTS]: '1750',
  [EbayConditionEnum.CERTIFIED_REFURBISHED]: '2000',
  [EbayConditionEnum.EXCELLENT_REFURBISHED]: '2010',
  [EbayConditionEnum.VERY_GOOD_REFURBISHED]: '2020',
  [EbayConditionEnum.GOOD_REFURBISHED]: '2030',
  [EbayConditionEnum.SELLER_REFURBISHED]: '2500',
  [EbayConditionEnum.USED_EXCELLENT]: '3000',
  [EbayConditionEnum.USED_VERY_GOOD]: '4000',
  [EbayConditionEnum.USED_GOOD]: '5000',
  [EbayConditionEnum.USED_ACCEPTABLE]: '6000',
  [EbayConditionEnum.FOR_PARTS_OR_NOT_WORKING]: '7000',
};

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

/** New-family fallbacks, in preference order. Never drops to a used or refurbished condition. */
const NEW_FAMILY_ORDER: EbayConditionEnum[] = [
  EbayConditionEnum.NEW,
  EbayConditionEnum.NEW_OTHER,
  EbayConditionEnum.NEW_WITH_DEFECTS,
];

/** Used-family fallbacks for an Amazon Renewed unit. `LIKE_NEW` / `CERTIFIED_REFURBISHED` are never chosen. */
const USED_EXCELLENT_ORDER: EbayConditionEnum[] = [
  EbayConditionEnum.USED_EXCELLENT,
  EbayConditionEnum.USED_VERY_GOOD,
  EbayConditionEnum.USED_GOOD,
  EbayConditionEnum.SELLER_REFURBISHED,
];

/**
 * Settle the title-derived condition against what the resolved eBay leaf
 * category accepts (`getItemConditionPolicies`).
 *
 * - No policy known (`allowedConditionIds` null or empty) → keep the preferred
 *   condition: exactly today's behaviour.
 * - Preferred is allowed → keep.
 * - A new item never turns into a used/refurbished one to please a category
 *   (that would misdescribe the product): the first allowed NEW-family
 *   condition, else keep the preferred one and let eBay refuse.
 * - A Renewed unit may move to a neighbouring used condition, else is kept.
 *
 * `conditionRequired` is accepted for the policy's completeness; the Inventory
 * API always sends a condition, so it changes nothing today.
 */
export function resolveConditionForCategory(
  preferred: EbayConditionEnum | string,
  allowedConditionIds: string[] | null,
  _conditionRequired: boolean
): EbayConditionEnum {
  const start = preferred as EbayConditionEnum;
  if (!allowedConditionIds || allowedConditionIds.length === 0) {
    return start;
  }
  const allowed = new Set(allowedConditionIds.map((id) => String(id)));
  const accepts = (condition: EbayConditionEnum): boolean => allowed.has(EBAY_CONDITION_ID[condition]);

  if (accepts(start)) {
    return start;
  }
  if (NEW_FAMILY_ORDER.includes(start)) {
    return NEW_FAMILY_ORDER.find(accepts) ?? start;
  }
  if (start === EbayConditionEnum.USED_EXCELLENT) {
    return USED_EXCELLENT_ORDER.find(accepts) ?? start;
  }
  return start;
}
