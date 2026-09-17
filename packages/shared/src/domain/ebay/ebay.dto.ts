/**
 * eBay Domain DTOs
 * Used by backend for class-validator decorators
 */

import type { EbayAccountStatus, EbayMarketplaceId } from './ebay.types';

/**
 * Internal DTO - contains sensitive tokens. NEVER send to frontend.
 */
export class EbayAccountDto {
  id!: string;
  userId!: string;
  sellerId!: string;
  storeName?: string;
  marketplaceId!: EbayMarketplaceId;
  accessToken!: string;
  refreshToken!: string;
  accessTokenExpiresAt!: string;
  status!: EbayAccountStatus;
  createdAt!: string;
  updatedAt!: string;
}

/**
 * Public DTO - safe to send to frontend. No tokens exposed.
 */
export class EbayAccountPublicDto {
  id!: string;
  userId!: string;
  /** eBay's IMMUTABLE user id — the store's identity. Opaque; not for display. */
  sellerId!: string;
  /** The seller's eBay username, for display. Can change, may be null. */
  ebayUsername?: string | null;
  storeName?: string;
  marketplaceId!: EbayMarketplaceId;
  status!: EbayAccountStatus;
  createdAt!: string;
  updatedAt!: string;
}

export class CreateEbayConnectUrlRequestDto {
  marketplaceId?: EbayMarketplaceId;
}

export class CreateEbayConnectUrlResponseDto {
  url!: string;
  state!: string;
}

export class GetEbayAccountsResponseDto {
  items!: EbayAccountPublicDto[];
  total!: number;
}
