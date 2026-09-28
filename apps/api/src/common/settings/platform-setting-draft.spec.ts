import {
  PlatformSettingDraftIssue,
  PlatformSettingKey,
  PlatformSettingType,
  checkPlatformSettingDraft,
  isPlatformSettingDraftDirty,
  isValidProxyUrl,
  partitionProxyList,
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

  it('flags the first malformed scraper proxy entry by position, never by value', () => {
    const proxyRules = { key: PlatformSettingKey.SCRAPER_PROXIES, ...stringRules };
    expect(checkPlatformSettingDraft(proxyRules, 'http://u:p@h:1,socks5h://h:1080')).toEqual({ valid: true });
    const check = checkPlatformSettingDraft(proxyRules, 'http://u:p@h:1, ,h:2:u:p,ftp://h:3');
    expect(check).toEqual({ valid: false, issue: PlatformSettingDraftIssue.NOT_A_PROXY_URL, entry: 2 });
    expect(JSON.stringify(check)).not.toContain('u:p');
  });
});

describe('proxy URL grammar', () => {
  it('accepts http/https/socks5/socks5h with a port up to 65535', () => {
    for (const ok of ['http://h:1', 'https://u:p@h.example.com:443', 'socks5://h:1080', 'socks5h://u:p@1.2.3.4:65535']) {
      expect(isValidProxyUrl(ok)).toBe(true);
    }
    for (const bad of ['h:1:u:p', 'ftp://h:1', 'http://h', 'http://h:65536', 'http://h:123456', 'http://a b:1']) {
      expect(isValidProxyUrl(bad)).toBe(false);
    }
  });

  it('partitions a list into de-duplicated valid entries and 1-based bad positions', () => {
    expect(partitionProxyList('http://a:1\nbad, http://a:1 ,,http://b:2\n')).toEqual({
      valid: ['http://a:1', 'http://b:2'],
      invalidEntries: [2],
    });
    expect(partitionProxyList(null)).toEqual({ valid: [], invalidEntries: [] });
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
