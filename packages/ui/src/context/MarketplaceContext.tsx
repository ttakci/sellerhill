import React, { createContext, useContext, useMemo } from 'react';

import type { MarketplaceContextValue, MarketplaceProviderProps } from './MarketplaceContext.types';

/**
 * Production hosts are the fallback: a deployment that forgets the provider
 * still links to real listings rather than to nothing.
 */
const DEFAULT_MARKETPLACE_URLS: MarketplaceContextValue = {
  buildEbayItemUrl: (itemId: string) => `https://www.ebay.com/itm/${itemId}`,
  buildAmazonProductUrl: (asin: string) => `https://www.amazon.com/dp/${asin}`,
};

export const MarketplaceContext = createContext<MarketplaceContextValue>(DEFAULT_MARKETPLACE_URLS);

export const MarketplaceProvider: React.FC<MarketplaceProviderProps> = ({
  buildEbayItemUrl,
  buildAmazonProductUrl,
  children,
}) => {
  const value = useMemo(
    () => ({
      buildEbayItemUrl: buildEbayItemUrl ?? DEFAULT_MARKETPLACE_URLS.buildEbayItemUrl,
      buildAmazonProductUrl: buildAmazonProductUrl ?? DEFAULT_MARKETPLACE_URLS.buildAmazonProductUrl,
    }),
    [buildEbayItemUrl, buildAmazonProductUrl]
  );

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
};

/** Falls back to production hosts when no provider is mounted (tests, isolated stories). */
export const useMarketplaceContext = (): MarketplaceContextValue => useContext(MarketplaceContext);
