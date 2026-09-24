import { GC_MIN_OBJECT_AGE_MS, isObjectOldEnoughToDelete, selectOrphanKeys } from './image-mirror-gc';

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

describe('isObjectOldEnoughToDelete', () => {
  const now = new Date('2026-09-24T00:00:00.000Z');

  it('returns true when the object is older than the safety margin', () => {
    const lastModified = new Date(now.getTime() - GC_MIN_OBJECT_AGE_MS - 1000);
    expect(isObjectOldEnoughToDelete(lastModified, now)).toBe(true);
  });

  it('returns false when the object is within the safety margin', () => {
    const lastModified = new Date(now.getTime() - GC_MIN_OBJECT_AGE_MS + 1000);
    expect(isObjectOldEnoughToDelete(lastModified, now)).toBe(false);
  });

  it('returns false when LastModified is missing — absence of evidence is not evidence it is old', () => {
    expect(isObjectOldEnoughToDelete(undefined, now)).toBe(false);
  });
});
