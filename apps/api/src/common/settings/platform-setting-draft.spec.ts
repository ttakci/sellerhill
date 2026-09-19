import {
  PlatformSettingDraftIssue,
  PlatformSettingType,
  checkPlatformSettingDraft,
  isPlatformSettingDraftDirty,
} from '@repo/shared';

const numberRules = { type: PlatformSettingType.NUMBER, min: 1, max: 90 };
const stringRules = { type: PlatformSettingType.STRING, min: null, max: null };

describe('checkPlatformSettingDraft', () => {
  it('refuses an empty or whitespace-only value', () => {
    expect(checkPlatformSettingDraft(stringRules, '   ')).toEqual({
      valid: false,
      issue: PlatformSettingDraftIssue.REQUIRED,
    });
  });

  it('accepts any non-empty text for a string setting', () => {
    expect(checkPlatformSettingDraft(stringRules, 'abc')).toEqual({ valid: true });
  });

  it('refuses a number that is not one', () => {
    expect(checkPlatformSettingDraft(numberRules, '12x')).toEqual({
      valid: false,
      issue: PlatformSettingDraftIssue.NOT_A_NUMBER,
    });
  });

  it('reports the bound that was crossed', () => {
    expect(checkPlatformSettingDraft(numberRules, '0')).toEqual({
      valid: false,
      issue: PlatformSettingDraftIssue.BELOW_MIN,
      bound: 1,
    });
    expect(checkPlatformSettingDraft(numberRules, '91')).toEqual({
      valid: false,
      issue: PlatformSettingDraftIssue.ABOVE_MAX,
      bound: 90,
    });
  });

  it('accepts a number on either bound', () => {
    expect(checkPlatformSettingDraft(numberRules, '1')).toEqual({ valid: true });
    expect(checkPlatformSettingDraft(numberRules, '90')).toEqual({ valid: true });
  });
});

describe('isPlatformSettingDraftDirty', () => {
  it('is clean when nothing was typed', () => {
    expect(isPlatformSettingDraftDirty('5', undefined, false)).toBe(false);
  });

  it('is clean when the stored value is retyped', () => {
    expect(isPlatformSettingDraftDirty('5', '5', false)).toBe(false);
  });

  it('is dirty when the value differs', () => {
    expect(isPlatformSettingDraftDirty('5', '6', false)).toBe(true);
    expect(isPlatformSettingDraftDirty(null, 'x', false)).toBe(true);
  });

  it('treats any typed secret as a replacement, and an empty one as untouched', () => {
    expect(isPlatformSettingDraftDirty(null, 'k', true)).toBe(true);
    expect(isPlatformSettingDraftDirty(null, '', true)).toBe(false);
  });
});
