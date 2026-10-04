import { describe, expect, it } from 'vitest';

import { blockedAsinsDraft, toSaveBlockedAsins } from './blockedAsinsDraft';

describe('blocked ASINs draft', () => {
  it('a store with no list of its own shows the global list, marked inherited', () => {
    expect(blockedAsinsDraft(null, ['B0GGGGGGGG'], false)).toEqual({ text: 'B0GGGGGGGG', inherited: true });
    expect(blockedAsinsDraft(undefined, ['B0GGGGGGGG'], false)).toEqual({ text: 'B0GGGGGGGG', inherited: true });
  });

  it("a store's own list (even an empty one) is not inherited", () => {
    expect(blockedAsinsDraft([], ['B0GGGGGGGG'], false)).toEqual({ text: '', inherited: false });
    expect(blockedAsinsDraft(['B0AAAAAAAA', 'B0BBBBBBBB'], null, false)).toEqual({
      text: 'B0AAAAAAAA\nB0BBBBBBBB',
      inherited: false,
    });
  });

  it('the global scope shows its own list', () => {
    expect(blockedAsinsDraft(['B0GGGGGGGG'], ['B0GGGGGGGG'], true)).toEqual({ text: 'B0GGGGGGGG', inherited: false });
    expect(blockedAsinsDraft(null, null, true)).toEqual({ text: '', inherited: false });
  });

  it('an untouched list is not sent', () => {
    const original = blockedAsinsDraft(null, ['B0GGGGGGGG'], false);
    expect(toSaveBlockedAsins(original.text, original)).toBeUndefined();
  });

  it('an edited list is sent cleaned, and an emptied one as []', () => {
    const original = blockedAsinsDraft(null, ['B0GGGGGGGG'], false);
    expect(toSaveBlockedAsins('', original)).toEqual([]);
    expect(toSaveBlockedAsins('b0aaaaaaaa, B0BBBBBBBB\nbad', original)).toEqual(['B0AAAAAAAA', 'B0BBBBBBBB']);
  });
});
