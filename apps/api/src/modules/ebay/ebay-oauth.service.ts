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
  /**
   * eBay's Commerce Identity API is hosted on a different subdomain than
   * every other REST API — `apiz.ebay.com`/`apiz.sandbox.ebay.com`, not
   * `api.ebay.com`/`api.sandbox.ebay.com`. This is documented eBay behavior,
   * not a typo: hitting `commerce/identity/v1/user` on the normal API host
   * returns a plain 404 (verified live in production, 2026-09-16 — a
   * connected seller's identity call failed with "Request failed with
   * status code 404", leaving `ebay_accounts.seller_id`/`store_name` stuck
   * at the JWT-decode fallback value `'unknown'` for every connection).
   */
  private readonly identityApiBaseUrl: string;
  private readonly scopes: readonly string[];

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('EBAY_CLIENT_ID') || '';
    this.clientSecret = this.configService.get<string>('EBAY_CLIENT_SECRET') || '';
    this.redirectUri = this.configService.get<string>('EBAY_REDIRECT_URI') || '';
    this.ruName = this.configService.get<string>('EBAY_RUNAME') || '';
    this.environment = this.configService.get<'sandbox' | 'production'>('EBAY_ENVIRONMENT') || 'sandbox';
    this.scopes = EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES;

    this.authUrl = this.configService.get<string>('EBAY_AUTH_URL') || '';
    this.tokenUrl = this.configService.get<string>('EBAY_TOKEN_URL') || '';
    this.apiBaseUrl = this.configService.get<string>('EBAY_REST_API_URL') || '';
    this.identityApiBaseUrl = this.apiBaseUrl.replace(/^(https?:\/\/)api\./, '$1apiz.');

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
   * Resolve who the connected seller is.
   *
   * `sellerId` is eBay's IMMUTABLE user id and nothing else. It is the key for
   * `ebay_accounts (seller_id, marketplace_id)` and for the one-trial-per-store
   * ledger, so it must be a value the seller cannot change. eBay's Identity API
   * reference says so directly: `userId` "is the eBay immutable user ID of the
   * user's account and can always be used to identify the user", while
   * `username` "can be changed by the user" (and, since 2025-09-26, is not even
   * returned for some U.S. users). This method used to prefer the username,
   * which let a renamed account claim a second free trial and gave an honest
   * seller who renamed a duplicate store on reconnect.
   *
   * FAILS CLOSED when the immutable id cannot be read. The previous fallbacks
   * (a JWT `sub` that eBay user tokens do not carry, a `privilege` call that
   * returns no user id, then the literal string 'unknown') meant every failed
   * lookup shared ONE seller id — one seller's trial claim would then block
   * everyone else's, or collide on the unique key. A refused connect the
   * seller can simply retry is the correct outcome.
   */
  async getSellerInfo(
    accessToken: string
  ): Promise<{ sellerId: string; username: string | null; storeName: string }> {
    this.logger.log(`Fetching seller information from eBay APIs (${this.environment})`);

    interface IdentityData {
      username?: string;
      userId?: string;
      businessName?: string;
    }
    let identity: IdentityData | undefined;
    try {
      // Deliberately identityApiBaseUrl, not apiBaseUrl — see the field comment.
      const identityResponse = await axios.get<IdentityData>(
        `${this.identityApiBaseUrl}/commerce/identity/v1/user`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      identity = identityResponse.data;
    } catch (error: unknown) {
      this.logger.error(
        'eBay Identity API call failed; refusing the connect rather than guessing the seller',
        error instanceof Error ? error.message : String(error)
      );
      throw new InternalServerErrorException('ebay.errors.identityUnavailable');
    }

    const sellerId = identity?.userId?.trim();
    if (!sellerId) {
      this.logger.error('eBay Identity API returned no immutable userId; refusing the connect');
      throw new InternalServerErrorException('ebay.errors.identityUnavailable');
    }
    // Display only. It can change and may be absent, so nothing keys on it.
    const username = identity?.username?.trim() || null;

    let storeName = identity?.businessName?.trim() || '';
    try {
      // The official store name, when the seller has a Store subscription.
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
      // Many sellers have no Store subscription; a 404 here is normal.
      this.logger.debug(
        'Store API failed (likely no store subscription):',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Never fall back to the immutable id for a NAME: it is an opaque string,
    // and store_name reaches buyers through the {{store_name}} message
    // placeholder. An empty name lets that placeholder use its own default.
    return { sellerId, username, storeName: storeName || username || '' };
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
