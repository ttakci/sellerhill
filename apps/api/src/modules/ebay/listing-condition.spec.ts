import { EbayConditionEnum, resolveConditionForCategory, resolveEbayCondition } from './listing-condition';

describe('resolveEbayCondition', () => {
  it('maps the Amazon title to the conservative defaults', () => {
    expect(resolveEbayCondition('Widget')).toBe(EbayConditionEnum.NEW);
    expect(resolveEbayCondition('Widget (Renewed)')).toBe(EbayConditionEnum.USED_EXCELLENT);
    expect(resolveEbayCondition('Widget Open Box')).toBe(EbayConditionEnum.NEW_OTHER);
  });
});

describe('resolveConditionForCategory', () => {
  it('keeps the preferred condition when the policy is unknown', () => {
    expect(resolveConditionForCategory(EbayConditionEnum.NEW, null, false)).toBe(EbayConditionEnum.NEW);
    expect(resolveConditionForCategory(EbayConditionEnum.NEW, [], true)).toBe(EbayConditionEnum.NEW);
  });

  it('keeps the preferred condition when the category allows it', () => {
    expect(resolveConditionForCategory(EbayConditionEnum.NEW, ['1000', '3000'], false)).toBe(EbayConditionEnum.NEW);
  });

  it('moves NEW to the first allowed new-family condition', () => {
    expect(resolveConditionForCategory(EbayConditionEnum.NEW, ['1500', '1750'], false)).toBe(
      EbayConditionEnum.NEW_OTHER
    );
    expect(resolveConditionForCategory(EbayConditionEnum.NEW, ['1750', '3000'], false)).toBe(
      EbayConditionEnum.NEW_WITH_DEFECTS
    );
    expect(resolveConditionForCategory(EbayConditionEnum.NEW_OTHER, ['1000'], false)).toBe(EbayConditionEnum.NEW);
  });

  it('never turns a new item into a used or refurbished one', () => {
    expect(resolveConditionForCategory(EbayConditionEnum.NEW, ['3000', '4000', '2750', '2000'], true)).toBe(
      EbayConditionEnum.NEW
    );
  });

  it('moves a Renewed unit to a neighbouring used condition, else keeps it', () => {
    expect(resolveConditionForCategory(EbayConditionEnum.USED_EXCELLENT, ['4000', '5000'], false)).toBe(
      EbayConditionEnum.USED_VERY_GOOD
    );
    expect(resolveConditionForCategory(EbayConditionEnum.USED_EXCELLENT, ['2500'], false)).toBe(
      EbayConditionEnum.SELLER_REFURBISHED
    );
    expect(resolveConditionForCategory(EbayConditionEnum.USED_EXCELLENT, ['1000'], false)).toBe(
      EbayConditionEnum.USED_EXCELLENT
    );
  });

  it('never picks LIKE_NEW or CERTIFIED_REFURBISHED', () => {
    const picked = resolveConditionForCategory(EbayConditionEnum.USED_EXCELLENT, ['2750', '2000'], false);
    expect(picked).toBe(EbayConditionEnum.USED_EXCELLENT);
  });
});
