import { SUPPORTED_EBAY_MARKETPLACES, type EbayMarketplaceId } from '@repo/shared';
import type { TFunction } from 'i18next';

import type { EbayMarketplaceOption } from '@/domain-ui/ConnectEbayPrompt/ConnectEbayPrompt.types';

/** Friendly label for one marketplace id — the single source both the picker and any store-list display resolve through, so they can never drift. */
export function getEbayMarketplaceLabel(t: TFunction, marketplaceId: EbayMarketplaceId): string {
  return t(`ebay:ebay.connect.marketplace${marketplaceId.replace('EBAY_', '')}`);
}

/**
 * Select options for the eBay marketplace picker, sourced from the single
 * SUPPORTED_EBAY_MARKETPLACES allowlist — enabling a second marketplace in
 * production is one array entry there, not a change here. Used by every
 * eBay-connect entry point so the picker can never drift between them.
 */
export function getEbayMarketplaceOptions(t: TFunction): EbayMarketplaceOption[] {
  return SUPPORTED_EBAY_MARKETPLACES.map((marketplaceId) => ({
    label: getEbayMarketplaceLabel(t, marketplaceId),
    value: marketplaceId,
  }));
}
