import { readFileSync } from 'fs';
import { join } from 'path';

import { describe, expect, it } from 'vitest';

/**
 * One active store for the whole seller app: store-scoped pages read the store
 * from `useActiveStore()` (the top-bar switcher), never from `?store=` and
 * never from a store filter of their own. A page that reads the URL again
 * would show one store while the switcher names another.
 */
const SRC = join(__dirname, '..', '..');
const read = (rel: string): string => readFileSync(join(SRC, rel), 'utf8');

/** [file that must not read `?store=`, file in that page that must call useActiveStore] */
const PAGES: Array<[string[], string]> = [
  [['features/dashboard/hooks/useDashboardUrlState.ts', 'features/dashboard/DashboardPage/DashboardPage.container.tsx'], 'features/dashboard/DashboardPage/DashboardPage.container.tsx'],
  [['features/action-center/ActionCenterPage/ActionCenterPage.container.tsx'], 'features/action-center/ActionCenterPage/ActionCenterPage.container.tsx'],
  [['features/orders/all/hooks/useOrdersFilters.ts', 'features/orders/all/OrdersAllPage.container.tsx'], 'features/orders/all/hooks/useOrdersFilters.ts'],
  [['features/returns/ReturnsPage/hooks/useReturnsUrlState.ts', 'features/returns/ReturnsPage/ReturnsPage.container.tsx'], 'features/returns/ReturnsPage/hooks/useReturnsUrlState.ts'],
  [['features/messages/hooks/useMessagesUrlState.ts', 'features/messages/MessagesPage/MessagesPage.container.tsx'], 'features/messages/hooks/useMessagesUrlState.ts'],
];

describe('store-scoped pages follow the active store', () => {
  it.each(PAGES)('%s', (files, reader) => {
    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/\.get\('store'\)/);
      expect(source, file).not.toMatch(/useStoreFilterOptions/);
    }
    expect(read(reader)).toMatch(/useActiveStore\(/);
  });
});
