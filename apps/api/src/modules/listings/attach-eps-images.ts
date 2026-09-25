import type { ProductData } from '@repo/shared';

/**
 * Resolve a product's EPS gallery + description images for one store, and
 * write the result onto `product` in place.
 *
 * Standalone — importing neither `ListingsService` nor
 * `ListingProcessorService` — so both the create path
 * (`ListingProcessorService.processListingBatch`) and the draft-publish path
 * (`ListingsService.prepareDraftForPublish`) can call it without those two
 * files importing from each other. `ListingProcessorService` already injects
 * `ListingsService` for DI, and NestJS captures that dependency's type via
 * `design:paramtypes` metadata at module LOAD time, not call time. A reverse
 * import — `listings.service.ts` pulling this helper back out of
 * `listing-processor.service.ts` — would close that require cycle, and
 * whichever of the two files' classes gets decorated second could then read
 * `undefined` for its counterpart's constructor parameter, depending only on
 * which file the module graph happens to `require()` first. That failure is
 * load-order-dependent, so it would not reproduce reliably and no unit test
 * would catch it — hence this file has no service-level dependency to cycle
 * on at all.
 *
 * Never throws: `EbayImageResolver.resolve` already never throws, but this
 * survives a rejection anyway — a picture must not be able to fail a
 * listing.
 *
 * No-ops (leaving `product` untouched, calling the resolver zero times)
 * when:
 * - there is no eBay account to key the cache on. The draft-publish path can
 *   resolve one to `null` (`listing.ebayAccountId || activeAccountId ||
 *   null`) — there is no store to charge the upload to or key
 *   `product_ebay_images` on.
 * - the product has no source images at all.
 */
export interface EpsImageResolverLike {
  resolve(
    productId: string,
    ebayAccountId: string,
    sourceUrls: string[]
  ): Promise<{ galleryUrls: string[]; descriptionUrl: string }>;
}

export async function attachEpsImages(
  resolver: EpsImageResolverLike,
  productId: string,
  ebayAccountId: string | null | undefined,
  product: ProductData
): Promise<void> {
  if (!ebayAccountId) {
    return;
  }
  const sourceUrls = product.imageUrls;
  if (!sourceUrls || sourceUrls.length === 0) {
    return;
  }
  try {
    const { galleryUrls, descriptionUrl } = await resolver.resolve(productId, ebayAccountId, sourceUrls);
    product.imageUrls = galleryUrls;
    product.mainImageUrl = descriptionUrl;
  } catch {
    // Deliberately silent — EbayImageResolver.resolve already never throws,
    // but this must survive a rejection anyway.
  }
}
