import { useEffect } from 'react';

import { useActiveStore } from './useActiveStore';

/**
 * A record of another store — a deep link, an Action Center row, a link
 * someone shared — makes that store active, so a page never shows a record
 * under the wrong store in the top bar. The page's own params (an open return,
 * a tab) are kept. Runs only once the record's store is known and differs.
 */
export const useFollowRecordStore = (recordStoreId: string | null | undefined): void => {
  const { activeStoreId, setActiveStore } = useActiveStore();
  useEffect(() => {
    if (recordStoreId && activeStoreId && recordStoreId !== activeStoreId) {
      setActiveStore(recordStoreId, { keepParams: true });
    }
  }, [recordStoreId, activeStoreId, setActiveStore]);
};
