import type { DropdownItem } from '@repo/ui';
import React, { useMemo } from 'react';

import { StoreSwitcherComponent } from './StoreSwitcher.component';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getStoreLabel } from '@/features/ebay/utils/storeLabel';

/**
 * The ONE place the seller picks the eBay store every store-scoped page works
 * on. One store: a plain label.
 */
export const StoreSwitcher = (): React.ReactElement | null => {
  const { activeStoreId, stores, setActiveStore } = useActiveStore();
  const hasMenu = stores.length > 1;

  const items = useMemo<DropdownItem[]>(
    () =>
      stores.map((store) => ({
        label: getStoreLabel(store),
        selected: store.id === activeStoreId,
        onClick: () => setActiveStore(store.id),
      })),
    [stores, activeStoreId, setActiveStore]
  );

  const active = stores.find((store) => store.id === activeStoreId);
  return (
    <StoreSwitcherComponent
      visible={Boolean(active)}
      activeLabel={active ? getStoreLabel(active) : ''}
      hasMenu={hasMenu}
      items={items}
    />
  );
};
