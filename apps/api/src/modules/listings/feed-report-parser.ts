import * as zlib from 'zlib';

/**
 * Parses `LMS_ACTIVE_INVENTORY_REPORT`, whose schema eBay documents nowhere —
 * the Feed API reference defers to the Merchant Data XSD and never states a
 * concrete shape. This is written against a REAL report captured from a live
 * store (2026-09-22), not a guess:
 *
 *   <?xml version="1.0" encoding="UTF-8"?>
 *   <BulkDataExchangeResponses xmlns="urn:ebay:apis:eBLBaseComponents">
 *     <ActiveInventoryReport>
 *       <SKUDetails>
 *         <SKU>B07VQ1ZHY1</SKU>
 *         <Price currencyID="USD">15.38</Price>
 *         <Quantity>1</Quantity>
 *         <ItemID>206349816749</ItemID>
 *       </SKUDetails>
 *       ...
 *     </ActiveInventoryReport>
 *   </BulkDataExchangeResponses>
 *
 * Three things the report does NOT carry, confirmed by that capture rather
 * than inferred from eBay's one-line description: no title, no image, no
 * `apiModel`/`InventoryTrackingMethod`. That is why import discovery stays on
 * `discoverActiveListings` (Trading) — see CLAUDE.md "Periodic listing
 * reconciliation".
 *
 * `<SKU>` IS NOT OURS. A captured report showed bare ASINs (`B07VQ1ZHY1`) with
 * no `-NEW` suffix — our own `buildSku` always appends one — meaning those
 * listings were published by a different tool (this seller's prior easync
 * usage, most likely). The eBay `<SKU>` element is whatever tool published the
 * listing chose to write there, and cannot be assumed to equal anything of
 * ours. `<ItemID>` is the only field guaranteed to match `listings.ebay_item_id`
 * — every reconciliation join uses THAT, never `<SKU>`.
 *
 * Content-Type observed on the wire was `application/json` while the actual
 * body was this XML — eBay's header was simply wrong for this response.
 * `previewReport`/`fetchActiveInventoryReport` never trust content-type for
 * this reason; parsing is attempted regardless of what the header claimed.
 *
 * Uses hand-rolled regex extraction rather than an XML library, matching the
 * existing pattern in `EbayService.discoverActiveListings` for Trading's XML
 * — one parsing style for eBay XML in this codebase, no new dependency for a
 * four-field record.
 */

export interface ActiveInventoryReportItem {
  ebayItemId: string;
  /** Whatever tool published the listing wrote here — never assumed to be ours. */
  sku?: string;
  price?: number;
  currency?: string;
  quantity?: number;
}

/** gzip's magic number. eBay may or may not compress the body; both are handled. */
function isGzip(body: Buffer): boolean {
  return body.length > 2 && body[0] === 0x1f && body[1] === 0x8b;
}

/**
 * Yield the report's text content whatever eBay wrapped it in.
 *
 * Fails soft to the raw bytes decoded as UTF-8 rather than throwing: a body
 * that only LOOKS gzipped (or genuinely isn't, despite the header) should
 * still get a parse attempt — `parseActiveInventoryReportXml` itself is
 * tolerant of unparseable input and returns an empty list rather than
 * throwing, so the worst case is zero items, not a crash.
 */
export function decodeReportBody(body: Buffer): string {
  if (isGzip(body)) {
    try {
      return zlib.gunzipSync(body).toString('utf8');
    } catch {
      // Not actually gzip despite the magic bytes matching by coincidence, or
      // a truncated/corrupt stream. Fall through to a raw decode.
    }
  }
  return body.toString('utf8');
}

/**
 * Extract every `<SKUDetails>` record from the report XML.
 *
 * Deliberately tolerant: a record with no `<ItemID>` is dropped rather than
 * failing the whole parse (it cannot be matched to anything of ours), and a
 * malformed document yields an empty array rather than throwing. The caller
 * (`EbayFeedSyncService`) treats an empty result the same way it treats a
 * failed download — never as "this seller has no listings" — so a parse
 * failure degrades to "nothing was learned this tick", not a wrong retirement.
 */
export function parseActiveInventoryReportXml(xml: string): ActiveInventoryReportItem[] {
  const blocks = xml.match(/<SKUDetails>[^]*?<\/SKUDetails>/g) ?? [];

  const textOf = (block: string, tag: string): string | undefined =>
    block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^]*?)<\\/${tag}>`))?.[1]?.trim();
  const attrOf = (block: string, tag: string, attrName: string): string | undefined =>
    block.match(new RegExp(`<${tag}[^>]*\\s${attrName}="([^"]*)"`))?.[1];

  const items: ActiveInventoryReportItem[] = [];
  for (const block of blocks) {
    const ebayItemId = textOf(block, 'ItemID');
    if (!ebayItemId) {
      continue;
    }
    const priceText = textOf(block, 'Price');
    const quantityText = textOf(block, 'Quantity');
    items.push({
      ebayItemId,
      sku: textOf(block, 'SKU'),
      price: priceText !== undefined && priceText !== '' ? Number(priceText) : undefined,
      currency: attrOf(block, 'Price', 'currencyID'),
      quantity: quantityText !== undefined && quantityText !== '' ? Number(quantityText) : undefined,
    });
  }
  return items;
}
