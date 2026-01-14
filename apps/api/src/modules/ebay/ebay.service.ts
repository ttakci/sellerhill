import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
    EBAY_ACCOUNT_STATUS,
    EBAY_MARKETPLACE,
    type CreateEbayConnectUrlResponse,
    type EbayAccountDto,
    type EbayMarketplaceId,
    type GetEbayAccountsResponse,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { EbayOAuthService } from './ebay-oauth.service';

/**
 * eBay account entity from database
 */
interface EbayAccountEntity {
  id: string;
  user_id: string;
  seller_id: string;
  marketplace_id: EbayMarketplaceId;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  status: 'active' | 'revoked' | 'error';
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class EbayService {
  private readonly logger = new Logger(EbayService.name);

  constructor(
    private readonly oauthService: EbayOAuthService,
    private readonly databaseService: DatabaseService
  ) {}

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
    const { userId, marketplaceId } = this.oauthService.validateState(state);

    // Exchange code for tokens
    const tokenResponse = await this.oauthService.exchangeCodeForTokens(code);

    // Get seller information
    const { sellerId } = await this.oauthService.getSellerInfo(tokenResponse.access_token);

    // Check if this seller account is already connected
    const existingAccounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT id FROM ebay_accounts 
       WHERE seller_id = $1 AND marketplace_id = $2 
       LIMIT 1`,
      [sellerId, marketplaceId]
    );

    if (existingAccounts.length > 0) {
      throw new ConflictException('ebay.errors.accountAlreadyConnected');
    }

    // Calculate token expiry
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Insert account into database
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `INSERT INTO ebay_accounts (
        user_id, seller_id, marketplace_id, 
        access_token, refresh_token, access_token_expires_at, 
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        userId,
        sellerId,
        marketplaceId,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt,
        EBAY_ACCOUNT_STATUS.ACTIVE,
      ]
    );

    const account = accounts[0];
    this.logger.log(`eBay account created successfully: ${account.id} for user: ${userId}, marketplace: ${marketplaceId}`);

    return { accountId: account.id, userId };
  }

  /**
   * Get all eBay accounts for a user
   */
  async getAccountsByUserId(userId: string): Promise<GetEbayAccountsResponse> {
    this.logger.log(`Getting eBay accounts for user: ${userId}`);

    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts 
       WHERE user_id = $1 
       ORDER BY created_at DESC`,
      [userId]
    );

    return {
      items: accounts.map((account) => this.mapToDto(account)),
      total: accounts.length,
    };
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(entity: EbayAccountEntity): EbayAccountDto {
    return {
      id: entity.id,
      userId: entity.user_id,
      sellerId: entity.seller_id,
      marketplaceId: entity.marketplace_id,
      accessToken: entity.access_token,
      refreshToken: entity.refresh_token,
      accessTokenExpiresAt: entity.access_token_expires_at.toISOString(),
      status: entity.status,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }
}
