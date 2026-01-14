import { BadRequestException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly ruName: string;
  private readonly environment: 'sandbox' | 'production';
  private readonly authUrl: string;
  private readonly tokenUrl: string;
  private readonly apiBaseUrl: string;
  private readonly scopes: readonly string[];

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('EBAY_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('EBAY_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('EBAY_REDIRECT_URI') || 'http://localhost:3000/api/v1/ebay/callback';
    this.ruName = this.configService.get<string>('EBAY_RUNAME') || '';
    this.environment = this.configService.get<'sandbox' | 'production'>('EBAY_ENVIRONMENT') || 'sandbox';
    this.scopes = EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES;

    if (this.environment === 'production') {
      this.authUrl = EBAY_OAUTH_CONSTANTS.AUTHORIZATION_URL_PROD;
      this.tokenUrl = EBAY_OAUTH_CONSTANTS.TOKEN_URL_PROD;
      this.apiBaseUrl = EBAY_OAUTH_CONSTANTS.PRODUCTION_API_BASE_URL;
    } else {
      this.authUrl = EBAY_OAUTH_CONSTANTS.AUTHORIZATION_URL_SANDBOX;
      this.tokenUrl = EBAY_OAUTH_CONSTANTS.TOKEN_URL_SANDBOX;
      this.apiBaseUrl = EBAY_OAUTH_CONSTANTS.SANDBOX_API_BASE_URL;
    }

    if (!this.clientId || !this.clientSecret) {
      this.logger.warn(`eBay OAuth credentials not configured for ${this.environment}. Please set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET`);
    } else {
      this.logger.log(`eBay OAuth Service initialized in ${this.environment} mode`);
    }
  }

  /**
   * Generate OAuth consent URL
   */
  generateConsentUrl(marketplaceId: EbayMarketplaceId = EBAY_MARKETPLACE.US, userId: string): { url: string; state: string } {
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
    this.logger.log(`Fetching seller information from eBay Commerce Identity API (${this.environment})`);
    this.logger.debug(`Using API Base URL: ${this.apiBaseUrl}`);

    try {
      // Try Identity API first to get username/userId
      const response = await axios.get(
        `${this.apiBaseUrl}/commerce/identity/v1/user`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      this.logger.debug('Identity API Response:', response.data);

      // Extract seller ID (username is better for display, userId is more stable)
      // We'll use username as the primary sellerId for the system
      const sellerId = response.data?.username || response.data?.userId || 'unknown';
      
      this.logger.log(`Successfully retrieved seller ID: ${sellerId}`);
      
      if (sellerId === 'unknown') {
        this.logger.warn('Identity API returned success but no username or userId found in:', response.data);
      }

      return { sellerId };
    } catch (error: any) {
      const errorData = error.response?.data;
      const statusCode = error.response?.status;
      
      this.logger.error(`Failed to fetch seller info from Identity API (Status: ${statusCode})`, {
        error: errorData || error.message,
        url: `${this.apiBaseUrl}/commerce/identity/v1/user`
      });
      
      try {
        this.logger.log('Trying Account API fallback...');
        // Fallback to Account API if Identity API fails
        const response = await axios.get(
          `${this.apiBaseUrl}/sell/account/v1/privilege`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        this.logger.debug('Account API fallback response:', response.data);
        
        // Some users might have userId in the Account API response depending on permissions
        if (response.data?.userId) {
          const sellerId = response.data.userId;
          this.logger.log(`Found seller ID in Account API: ${sellerId}`);
          return { sellerId };
        }

        const fallbackId = `ebay_user_${Date.now()}`;
        this.logger.warn(`Account API didn't provide userId, using auto-generated ID: ${fallbackId}`);
        return { sellerId: fallbackId };
      } catch (fallbackError: any) {
        this.logger.error('Account API fallback also failed', fallbackError.response?.data || fallbackError.message);
        const finalFallbackId = `ebay_user_${Date.now()}`;
        return { sellerId: finalFallbackId };
      }
    }
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
      return JSON.parse(decoded);
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
