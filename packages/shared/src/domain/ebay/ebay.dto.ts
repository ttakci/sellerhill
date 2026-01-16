/**
 * eBay Domain DTOs
 * Used by backend for class-validator decorators
 */

import type { EbayAccountStatus, EbayMarketplaceId } from './ebay.types';

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

export class CreateEbayConnectUrlRequestDto {
  marketplaceId?: EbayMarketplaceId;
}

export class CreateEbayConnectUrlResponseDto {
  url!: string;
  state!: string;
}

export class GetEbayAccountsResponseDto {
  items!: EbayAccountDto[];
  total!: number;
}
