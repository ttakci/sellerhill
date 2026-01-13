import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
    EBAY_ACCOUNT_STATUS,
    EBAY_MARKETPLACE,
    type CreateEbayConnectUrlResponse,
    type EbayAccountDto,
    type EbayMarketplaceId,
    type GetEbayAccountsResponse,
} from '@repo/shared';
import { EbayOAuthService } from './ebay-oauth.service';

/**
 * In-memory eBay account storage (replace with real database in production)
 */
interface EbayAccountEntity {
  id: string;
  userId: string;
  sellerId: string;
  marketplaceId: EbayMarketplaceId;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  status: 'active' | 'revoked' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class EbayService {
  private readonly logger = new Logger(EbayService.name);
  private readonly accounts: Map<string, EbayAccountEntity> = new Map();
  private readonly userAccountsIndex: Map<string, Set<string>> = new Map(); // userId -> Set<accountId>

  constructor(private readonly oauthService: EbayOAuthService) {}

  /**
   * Generate eBay connect URL
   */
  async createConnectUrl(userId: string, marketplaceId?: EbayMarketplaceId): Promise<CreateEbayConnectUrlResponse> {
    const marketplace = marketplaceId || EBAY_MARKETPLACE.US;
    this.logger.log(`Creating eBay connect URL for user ${userId}, marketplace: ${marketplace}`);

    const { url, state } = this.oauthService.generateConsentUrl(marketplace, userId);

    return { url, state };
  }

  /**
   * Handle OAuth callback
   */
  async handleCallback(code: string, state: string): Promise<{ accountId: string; userId: string }> {
    this.logger.log('Handling eBay OAuth callback');

    // Validate and decode state
    const { userId } = this.oauthService.validateState(state);

    // Exchange code for tokens
    const tokenResponse = await this.oauthService.exchangeCodeForTokens(code);

    // Get seller information
    const { sellerId } = await this.oauthService.getSellerInfo(tokenResponse.access_token);

    // Check if this seller account is already connected
    const existingAccount = this.findAccountBySellerIdAndMarketplace(sellerId, EBAY_MARKETPLACE.US);
    if (existingAccount) {
      throw new ConflictException('ebay.errors.accountAlreadyConnected');
    }

    // Create account
    const accountId = `ebay_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokenResponse.expires_in * 1000);

    const account: EbayAccountEntity = {
      id: accountId,
      userId,
      sellerId,
      marketplaceId: EBAY_MARKETPLACE.US,
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      accessTokenExpiresAt: expiresAt,
      status: EBAY_ACCOUNT_STATUS.ACTIVE,
      createdAt: now,
      updatedAt: now,
    };

    this.accounts.set(accountId, account);

    // Update user index
    if (!this.userAccountsIndex.has(userId)) {
      this.userAccountsIndex.set(userId, new Set());
    }
    this.userAccountsIndex.get(userId)!.add(accountId);

    this.logger.log(`eBay account created successfully: ${accountId} for user: ${userId}`);

    return { accountId, userId };
  }

  /**
   * Get all eBay accounts for a user
   */
  async getAccountsByUserId(userId: string): Promise<GetEbayAccountsResponse> {
    this.logger.log(`Getting eBay accounts for user: ${userId}`);

    const accountIds = this.userAccountsIndex.get(userId) || new Set();
    const accounts = Array.from(accountIds)
      .map((id) => this.accounts.get(id))
      .filter((account): account is EbayAccountEntity => account !== undefined)
      .map((account) => this.mapToDto(account));

    return {
      items: accounts,
      total: accounts.length,
    };
  }

  /**
   * Find account by seller ID and marketplace
   */
  private findAccountBySellerIdAndMarketplace(
    sellerId: string,
    marketplaceId: EbayMarketplaceId
  ): EbayAccountEntity | undefined {
    return Array.from(this.accounts.values()).find(
      (account) => account.sellerId === sellerId && account.marketplaceId === marketplaceId
    );
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(entity: EbayAccountEntity): EbayAccountDto {
    return {
      id: entity.id,
      userId: entity.userId,
      sellerId: entity.sellerId,
      marketplaceId: entity.marketplaceId,
      accessToken: entity.accessToken,
      refreshToken: entity.refreshToken,
      accessTokenExpiresAt: entity.accessTokenExpiresAt.toISOString(),
      status: entity.status,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }
}
