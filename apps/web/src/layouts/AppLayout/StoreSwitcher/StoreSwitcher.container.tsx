import type { DropdownItem } from '@repo/ui';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StoreSwitcherComponent } from './StoreSwitcher.component';

import {
  ACTION_CENTER_POLL_INTERVAL_MS,
  useGetActionCenterByStoreQuery,
} from '@/features/action-center/api/actionCenterApi';
import { storeOwnItemCount } from '@/features/action-center/utils/storeItemCount';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { getStoreLabel } from '@/features/ebay/utils/storeLabel';

/**
 * The ONE place the seller picks the eBay store every store-scoped page works
 * on. Each option carries that store's own waiting-action count, so work on a
 * store that is not selected is never hidden. One store: a plain label.
 */
export const StoreSwitcher = (): React.ReactElement | null => {
  const { t } = useTranslation(['translation']);
  const { activeStoreId, stores, setActiveStore } = useActiveStore();
  const storeIds = useMemo(() => stores.map((store) => store.id), [stores]);
  const hasMenu = stores.length > 1;

  // Same args as the sidebar badge's call in AppLayout, so RTK shares one request.
  const { data: byStore } = useGetActionCenterByStoreQuery(storeIds, {
    skip: storeIds.length === 0,
    pollingInterval: ACTION_CENTER_POLL_INTERVAL_MS,
  });

  const items = useMemo<DropdownItem[]>(
    () =>
      stores.map((store) => {
        const label = getStoreLabel(store);
        const count = storeOwnItemCount(byStore?.[store.id]);
        return {
          label: count > 0 ? t('translation:header.storeWithCount', { store: label, count }) : label,
          icon: store.id === activeStoreId ? 'check' : undefined,
          onClick: () => setActiveStore(store.id),
        };
      }),
    [stores, byStore, activeStoreId, setActiveStore, t]
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
