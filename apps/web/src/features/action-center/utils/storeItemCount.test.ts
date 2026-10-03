import type { ActionCenterSummaryDto } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { storeOwnItemCount } from './storeItemCount';

const summary = (items: Array<{ accountWide?: boolean }>): ActionCenterSummaryDto =>
  ({ groups: [{ items }] }) as unknown as ActionCenterSummaryDto;

describe('storeOwnItemCount', () => {
  it('counts the store’s own conditions and leaves account-wide ones out', () => {
    expect(storeOwnItemCount(summary([{}, { accountWide: false }, { accountWide: true }]))).toBe(2);
  });
  it('is 0 for a summary not loaded yet', () => {
    expect(storeOwnItemCount(undefined)).toBe(0);
  });
});
