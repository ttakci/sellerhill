import type React from 'react';

/**
 * Marketplace URL builders, injected by the app.
 *
 * The design system deliberately has no `@repo/shared` dependency, and eBay
 * links are environment-scoped (a sandbox item id is a dead link on ebay.com).
 * So `@repo/ui` renders the badge and the app decides what URL an id maps to —
 * supplied once at the root instead of threaded as a prop through the dozen
 * screens that render `IdBadge`.
 */
export interface MarketplaceContextValue {
  buildEbayItemUrl: (itemId: string) => string;
  buildAmazonProductUrl: (asin: string) => string;
}

export interface MarketplaceProviderProps extends Partial<MarketplaceContextValue> {
  children: React.ReactNode;
}
