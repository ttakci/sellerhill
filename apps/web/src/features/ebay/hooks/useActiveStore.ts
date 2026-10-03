import type { EbayAccountPublicDto } from '@repo/shared';
import { createContext, useContext } from 'react';

/**
 * The eBay store the seller is working on, chosen once in the top bar
 * (`StoreSwitcher`) and read by every store-scoped page and drawer.
 * `activeStoreId` is `null` only while the stores are loading or when the
 * seller has none — a page skips its store-scoped queries until it is set.
 */
export interface ActiveStoreContextValue {
  activeStoreId: string | null;
  stores: EbayAccountPublicDto[];
  /**
   * Make a store active. A plain switch starts the page over (only `?store=`
   * survives); `keepParams` is for a detail page following its record's store.
   */
  setActiveStore: (storeId: string, options?: { keepParams?: boolean }) => void;
}

const NO_ACTIVE_STORE: ActiveStoreContextValue = {
  activeStoreId: null,
  stores: [],
  setActiveStore: () => undefined,
};

export const ActiveStoreContext = createContext<ActiveStoreContextValue>(NO_ACTIVE_STORE);

/** Outside the seller shell (tests, the operator console) there is no store. */
export const useActiveStore = (): ActiveStoreContextValue => useContext(ActiveStoreContext);
