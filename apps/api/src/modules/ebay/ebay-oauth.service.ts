import { randomBytes } from 'crypto';

import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EBAY_MARKETPLACE, EBAY_OAUTH_CONSTANTS, type EbayMarketplaceId } from '@repo/shared';
import axios from 'axios';

interface EbayTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

@Injectable()
export class EbayOAuthService {
  private readonly logger = new Logger(EbayOAuthService.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly ruName: string;
  private readonly environment: 'sandbox' | 'production';
  private readonly authUrl: string;
  private readonly tokenUrl: string;
  private readonly apiBaseUrl: string;
  private readonly scopes: readonly string[];

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('EBAY_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('EBAY_CLIENT_SECRET') || '';
    this.redirectUri =
      this.configService.get<string>('EBAY_REDIRECT_URI') || 'http://localhost:3000/api/v1/ebay/callback';
    this.ruName = this.configService.get<string>('EBAY_RUNAME') || '';
    this.environment = this.configService.get<'sandbox' | 'production'>('EBAY_ENVIRONMENT') || 'sandbox';
    this.scopes = EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES;

    this.authUrl = this.configService.get<string>('EBAY_AUTH_URL') || '';
    this.tokenUrl = this.configService.get<string>('EBAY_TOKEN_URL') || '';
    this.apiBaseUrl = this.configService.get<string>('EBAY_REST_API_URL') || '';

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(
        `eBay OAuth credentials not configured for ${this.environment}. Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET`
      );
    } else {
      this.logger.log(`eBay OAuth Service initialized in ${this.environment} mode`);
    }
  }

  /**
   * Generate OAuth consent URL
   */
  generateConsentUrl(
    marketplaceId: EbayMarketplaceId = EBAY_MARKETPLACE.US,
    userId: string
  ): { url: string; state: string } {
    const state = this.generateState(userId, marketplaceId);

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.ruName || this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state,
    });

    const url = `${this.authUrl}?${params.toString()}`;

    this.logger.log(`Generated consent URL for user ${userId}, marketplace: ${marketplaceId} (${this.environment})`);
    if (this.environment === 'sandbox') {
      this.logger.debug(`Final OAuth URL: ${url}`);
    }

    return { url, state };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<EbayTokenResponse> {
    this.logger.log(`Exchanging authorization code for tokens (${this.environment})`);

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<EbayTokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.ruName || this.redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      this.logger.log('Successfully exchanged code for tokens');
      return response.data;
    } catch (error: unknown) {
      const axiosErr =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: unknown }; message?: string })
          : null;
      this.logger.error(
        'Failed to exchange code for tokens',
        axiosErr?.response?.data || (error instanceof Error ? error.message : String(error))
      );
      throw new InternalServerErrorException('ebay.errors.tokenExchangeFailed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<EbayTokenResponse> {
    this.logger.log(`Refreshing access token (${this.environment})`);

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<EbayTokenResponse>(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      this.logger.log('Successfully refreshed access token');
      return response.data;
    } catch (error: unknown) {
      const axiosErr =
        error instanceof Error && 'response' in error
          ? (error as { response?: { data?: unknown }; message?: string })
          : null;
      this.logger.error(
        'Failed to refresh access token',
        axiosErr?.response?.data || (error instanceof Error ? error.message : String(error))
      );
      throw new InternalServerErrorException('ebay.errors.tokenExchangeFailed');
    }
  }

  /**
   * Get seller information from eBay
   */
  async getSellerInfo(accessToken: string): Promise<{ sellerId: string; storeName: string }> {
    this.logger.log(`Fetching seller information from eBay APIs (${this.environment})`);

    let sellerId = 'unknown';
    let storeName = '';

    try {
      // 1. Get User/Identity info
      const identityResponse = await axios.get(`${this.apiBaseUrl}/commerce/identity/v1/user`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      interface IdentityData {
        username?: string;
        userId?: string;
        businessName?: string;
      }
      const identityData = identityResponse.data as IdentityData | undefined;
      sellerId = identityData?.username || identityData?.userId || 'unknown';
      storeName = identityData?.businessName || identityData?.username || '';

      this.logger.debug('Identity API Response:', identityData);
    } catch (error: unknown) {
      this.logger.warn(
        'Identity API failed, will try fallback',
        error instanceof Error ? error.message : String(error)
      );
    }

    try {
      // 2. Try to get Store specific info (more accurate for store name)
      interface StoreData {
        name?: string;
      }
      const storeResponse = await axios.get<StoreData>(`${this.apiBaseUrl}/sell/account/v1/store`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (storeResponse.data?.name) {
        storeName = storeResponse.data.name;
        this.logger.log(`Found official eBay store name: ${storeName}`);
      }
    } catch (error: unknown) {
      // Many sellers don't have a "Store" subscription, so 404 is common and expected
      this.logger.debug(
        'Store API failed (likely no store subscription):',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Final fallback for sellerId if still unknown
    if (sellerId === 'unknown') {
      try {
        interface PrivilegeData {
          userId?: string;
        }
        const fallbackResponse = await axios.get<PrivilegeData>(`${this.apiBaseUrl}/sell/account/v1/privilege`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
        sellerId = fallbackResponse.data?.userId || `ebay_user_${Date.now()}`;
      } catch (e) {
        sellerId = `ebay_user_${Date.now()}`;
      }
    }

    return { sellerId, storeName: storeName || sellerId };
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private generateState(userId: string, marketplaceId: EbayMarketplaceId): string {
    const randomPart = randomBytes(16).toString('hex');
    // Encode userId in state for retrieval during callback
    const stateData = {
      userId,
      marketplaceId,
      random: randomPart,
      timestamp: Date.now(),
    };
    return Buffer.from(JSON.stringify(stateData)).toString('base64url');
  }

  /**
   * Decode state parameter
   */
  decodeState(state: string): { userId: string; marketplaceId: EbayMarketplaceId; random: string; timestamp: number } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      const parsed = JSON.parse(decoded) as {
        userId: string;
        marketplaceId: EbayMarketplaceId;
        random: string;
        timestamp: number;
      };
      return parsed;
    } catch (error) {
      throw new BadRequestException('ebay.errors.invalidState');
    }
  }

  /**
   * Validate state parameter
   */
  validateState(state: string): { userId: string; marketplaceId: EbayMarketplaceId } {
    const decoded = this.decodeState(state);

    // Check if state is not too old (15 minutes)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - decoded.timestamp > maxAge) {
      throw new BadRequestException('ebay.errors.invalidState');
    }

    return { userId: decoded.userId, marketplaceId: decoded.marketplaceId };
  }
}
