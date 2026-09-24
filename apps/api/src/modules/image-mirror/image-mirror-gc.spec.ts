import { selectOrphanKeys } from './image-mirror-gc';

describe('selectOrphanKeys', () => {
  it('returns only keys no live product references', () => {
    const live = new Set(['a.jpg', 'b.jpg']);
    expect(selectOrphanKeys(['a.jpg', 'b.jpg', 'c.jpg'], live)).toEqual(['c.jpg']);
  });

  it('returns nothing when every key is live', () => {
    expect(selectOrphanKeys(['a.jpg'], new Set(['a.jpg']))).toEqual([]);
  });

  it('returns nothing when the live set is empty', () => {
    expect(selectOrphanKeys(['a.jpg', 'b.jpg'], new Set())).toEqual([]);
  });
});
