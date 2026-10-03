import { useEffect, useRef } from 'react';

import { useActiveStore } from './useActiveStore';

/**
 * A record of another store — a deep link, an Action Center row, a link
 * someone shared — makes that store active, so a page never shows a record
 * under the wrong store in the top bar. The page's own params (an open return,
 * a tab) are kept.
 *
 * ONCE per record: the follow happens when the record's store is first known.
 * A later switch in the top bar is the seller's own choice and is never undone
 * here (the provider sends a manual switch on a record page to its list).
 */
export const useFollowRecordStore = (recordStoreId: string | null | undefined): void => {
  const { activeStoreId, setActiveStore } = useActiveStore();
  const followedRecordStore = useRef<string | null>(null);
  useEffect(() => {
    if (!recordStoreId || !activeStoreId || followedRecordStore.current === recordStoreId) {
      return;
    }
    followedRecordStore.current = recordStoreId;
    if (recordStoreId !== activeStoreId) {
      setActiveStore(recordStoreId, { keepParams: true });
    }
  }, [recordStoreId, activeStoreId, setActiveStore]);
};
