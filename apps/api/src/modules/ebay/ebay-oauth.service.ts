import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { EBAY_MARKETPLACE, EBAY_OAUTH_CONSTANTS, type EbayMarketplaceId } from '@repo/shared';
import axios from 'axios';
import { randomBytes } from 'crypto';

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
  private readonly scopes: readonly string[];

  constructor() {
    this.clientId = process.env.EBAY_CLIENT_ID || '';
    this.clientSecret = process.env.EBAY_CLIENT_SECRET || '';
    this.redirectUri = process.env.EBAY_REDIRECT_URI || 'http://localhost:3000/api/v1/ebay/callback';
    this.scopes = EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES;

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn('eBay OAuth credentials not configured. Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET');
    }
  }

  /**
   * Generate OAuth consent URL
   */
  generateConsentUrl(marketplaceId: EbayMarketplaceId = EBAY_MARKETPLACE.US, userId: string): { url: string; state: string } {
    const state = this.generateState(userId);
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      state,
    });

    const url = `${EBAY_OAUTH_CONSTANTS.AUTHORIZATION_URL}?${params.toString()}`;

    this.logger.log(`Generated consent URL for user ${userId}, marketplace: ${marketplaceId}`);
    
    return { url, state };
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<EbayTokenResponse> {
    this.logger.log('Exchanging authorization code for tokens');

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<EbayTokenResponse>(
        EBAY_OAUTH_CONSTANTS.TOKEN_URL,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
        }
      );

      this.logger.log('Successfully exchanged code for tokens');
      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to exchange code for tokens', error.response?.data || error.message);
      throw new InternalServerErrorException('ebay.errors.tokenExchangeFailed');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<EbayTokenResponse> {
    this.logger.log('Refreshing access token');

    try {
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<EbayTokenResponse>(
        EBAY_OAUTH_CONSTANTS.TOKEN_URL,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${credentials}`,
          },
        }
      );

      this.logger.log('Successfully refreshed access token');
      return response.data;
    } catch (error: any) {
      this.logger.error('Failed to refresh access token', error.response?.data || error.message);
      throw new InternalServerErrorException('ebay.errors.tokenExchangeFailed');
    }
  }

  /**
   * Get seller information from eBay
   */
  async getSellerInfo(accessToken: string): Promise<{ sellerId: string }> {
    this.logger.log('Fetching seller information from eBay');

    try {
      // Using eBay's Commerce Account API to get seller profile
      const response = await axios.get(
        `${EBAY_OAUTH_CONSTANTS.PRODUCTION_API_BASE_URL}/sell/account/v1/privilege`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      // Extract seller ID from response (this may vary based on eBay's response structure)
      const sellerId = response.data?.userId || response.data?.sellerAccountId || 'unknown';
      
      this.logger.log(`Retrieved seller ID: ${sellerId}`);
      return { sellerId };
    } catch (error: any) {
      this.logger.warn('Failed to fetch seller info, using fallback', error.response?.data || error.message);
      // Fallback: generate a temporary seller ID
      return { sellerId: `ebay_seller_${Date.now()}` };
    }
  }

  /**
   * Generate secure state parameter for CSRF protection
   */
  private generateState(userId: string): string {
    const randomPart = randomBytes(16).toString('hex');
    // Encode userId in state for retrieval during callback
    const stateData = {
      userId,
      random: randomPart,
      timestamp: Date.now(),
    };
    return Buffer.from(JSON.stringify(stateData)).toString('base64url');
  }

  /**
   * Decode state parameter
   */
  decodeState(state: string): { userId: string; random: string; timestamp: number } {
    try {
      const decoded = Buffer.from(state, 'base64url').toString('utf-8');
      return JSON.parse(decoded);
    } catch (error) {
      throw new BadRequestException('ebay.errors.invalidState');
    }
  }

  /**
   * Validate state parameter
   */
  validateState(state: string): { userId: string } {
    const decoded = this.decodeState(state);
    
    // Check if state is not too old (15 minutes)
    const maxAge = 15 * 60 * 1000;
    if (Date.now() - decoded.timestamp > maxAge) {
      throw new BadRequestException('ebay.errors.invalidState');
    }

    return { userId: decoded.userId };
  }
}
