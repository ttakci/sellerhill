import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EBAY_ACCOUNT_STATUS,
  EBAY_DESCRIPTION_MAX_LENGTH,
  EBAY_INVENTORY_DESCRIPTION_MAX_LENGTH,
  EBAY_MARKETPLACE,
  EBAY_MARKETPLACE_CONFIG,
  EBAY_MAX_IMAGES,
  EBAY_NOT_APPLICABLE,
  EBAY_TITLE_MAX_LENGTH,
  EbayAccountStatus,
  type CreateEbayConnectUrlResponse,
  type EbayAccountPublicDto,
  type EbayMarketplaceId,
  type GetEbayAccountsResponse,
  type ListingCreationData,
} from '@repo/shared';
import axios from 'axios';

import { DatabaseService } from '../../common/database/database.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { isValidGtin, normalizeGtin } from '../../common/utils/gtin';
import { truncateHtml } from '../../common/utils/sanitize';

import { type AspectResolution, type CategoryAspect } from './aspect-builder';
import { AspectResolverService } from './aspect-resolver.service';
import { EbayOAuthService } from './ebay-oauth.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import {
  CategoryAspectsUnavailableError,
  CategoryResolutionError,
  ListingPublishExhaustedError,
} from './ebay.errors';
import { resolveEbayCondition } from './listing-condition';

/**
 * Prefix marking an encrypted-at-rest token value in `ebay_accounts`.
 * Legacy rows hold plaintext (no prefix) and are decrypt-passthrough until the
 * onModuleInit backfill re-encrypts them.
 */
const TOKEN_ENC_PREFIX = 'enc:';

/** eBay's category taxonomy changes on a release cadence, not per request. */
const CATEGORY_ASPECT_CACHE_TTL_MS = 60 * 60 * 1000;

/** What a successful publish produced, including the item-specifics audit trail. */
export interface EbayListingCreationResult {
  listingId: string;
  categoryName: string;
  categoryId: string;
  aspectResolution: AspectResolution;
}

/** Compact "which layer filled what" line — the diagnostic that replaces guessing. */
function summarizeAspectLayers(resolution: AspectResolution): string {
  const counts = new Map<string, number>();
  for (const decision of resolution.decisions) {
    if (decision.value) {
      counts.set(decision.layer, (counts.get(decision.layer) ?? 0) + 1);
    }
  }
  return (
    [...counts.entries()].map(([layer, count]) => `${layer}=${count}`).join(' ') ||
    'none'
  );
}

/** Helper to safely extract error message from unknown errors */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Axios error shape used for response data access */
interface AxiosErrorData {
  response?: {
    data?: {
      errors?: Array<{
        errorId?: number;
        message?: string;
        parameters?: Array<{ name?: string; value?: string }>;
      }>;
      error_description?: string;
    };
    status?: number;
  };
  message?: string;
}

function isAxiosErrorWithData(error: unknown): error is AxiosErrorData {
  return typeof error === 'object' && error !== null && 'response' in error && 'message' in error;
}

/** Axios error with response status + headers, for rate-limit retry decisions. */
interface RetryableAxiosError {
  response?: { status?: number; headers?: Record<string, string> };
}

function isRetryableAxiosError(error: unknown): error is RetryableAxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as RetryableAxiosError).response?.status === 'number'
  );
}

/** True for transient failures that are safe to retry after a backoff. */
function isTransientStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/** Parse an HTTP `Retry-After` header into ms (delta-seconds form only). */
function parseRetryAfterMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return null;
  }
  return Math.max(0, seconds) * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Typed axios response interfaces */
interface EbayOfferResponse {
  offerId: string;
}
interface EbayPublishResponse {
  listingId: string;
}
interface _EbayCategorySuggestion {
  categorySuggestions?: Array<{ category: { categoryId: string; categoryName?: string } }>;
}
interface _EbayAspectResponse {
  aspects?: Array<{ aspectConstraint?: { aspectMode?: string; aspectUsage?: string }; localizedAspectName: string }>;
}
interface _EbayOffersResponse {
  offers?: Array<Record<string, unknown>>;
}
interface _EbayInventoryResponse {
  availability?: { shipToLocationAvailability?: { quantity?: number } };
}

/**
 * eBay account entity from database
 */
interface EbayAccountEntity {
  id: string;
  user_id: string;
  seller_id: string;
  store_name?: string;
  marketplace_id: EbayMarketplaceId;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: Date;
  status: EbayAccountStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class EbayService implements OnModuleInit {
  private readonly logger = new Logger(EbayService.name);
  /**
   * At-rest encryption for eBay OAuth tokens (AES-256-GCM, same key as the
   * Amazon buyer-account credentials — `AMAZON_ENCRYPTION_KEY`). A leaked DB
   * dump must not yield working seller-API tokens.
   */
  private readonly tokenEncryption: EncryptionUtil;
  /** Category → aspect metadata cache (see getItemAspectsForCategory). */
  private readonly categoryAspectCache = new Map<string, { aspects: CategoryAspect[]; expiresAt: number }>();
  /** Title → resolved category cache; identical titles are common in bulk adds. */
  private readonly categorySuggestionCache = new Map<
    string,
    { categoryId: string; categoryName: string; expiresAt: number }
  >();

  constructor(
    private readonly oauthService: EbayOAuthService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService,
    private readonly taxonomyService: EbayTaxonomyService,
    private readonly aspectResolver: AspectResolverService
  ) {
    const key = this.configService.get<string>('AMAZON_ENCRYPTION_KEY');
    if (!key) {
      // Same hard requirement as AmazonAccountsService — the app already
      // cannot boot without this key, so failing fast here adds no new burden.
      throw new Error('AMAZON_ENCRYPTION_KEY environment variable is required');
    }
    this.tokenEncryption = new EncryptionUtil(key);
  }

  /**
   * One-time lazy migration: re-encrypt any legacy plaintext tokens still in
   * `ebay_accounts`. Best-effort — a failure logs and leaves the row as
   * plaintext (still readable via the decrypt-passthrough), never blocks boot.
   */
  async onModuleInit(): Promise<void> {
    try {
      const rows = await this.databaseService.query<{
        id: string;
        access_token: string;
        refresh_token: string;
      }>(
        `SELECT id, access_token, refresh_token FROM ebay_accounts
         WHERE access_token NOT LIKE $1 OR refresh_token NOT LIKE $1`,
        [`${TOKEN_ENC_PREFIX}%`]
      );
      for (const row of rows) {
        await this.databaseService.query(
          `UPDATE ebay_accounts SET access_token = $1, refresh_token = $2, updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [
            this.encryptToken(this.decryptToken(row.access_token)),
            this.encryptToken(this.decryptToken(row.refresh_token)),
            row.id,
          ]
        );
      }
      if (rows.length > 0) {
        this.logger.log(`Encrypted ${rows.length} legacy plaintext eBay token row(s) at rest`);
      }
    } catch (error: unknown) {
      this.logger.warn(`eBay token encryption backfill failed (will retry next boot): ${getErrorMessage(error)}`);
    }
  }

  /** Encrypt a token for storage. */
  private encryptToken(plaintext: string): string {
    return TOKEN_ENC_PREFIX + this.tokenEncryption.encrypt(plaintext);
  }

  /** Decrypt a stored token; legacy plaintext rows pass through unchanged. */
  private decryptToken(stored: string): string {
    if (!stored.startsWith(TOKEN_ENC_PREFIX)) {
      return stored;
    }
    return this.tokenEncryption.decrypt(stored.slice(TOKEN_ENC_PREFIX.length));
  }

  /**
   * Generate eBay connect URL
   */
  createConnectUrl(userId: string, marketplaceId?: EbayMarketplaceId): CreateEbayConnectUrlResponse {
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
    const { sellerId, storeName } = await this.oauthService.getSellerInfo(tokenResponse.access_token);

    // Check if this seller account is already connected (by seller_id or user token)
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
        user_id, seller_id, store_name, marketplace_id, 
        access_token, refresh_token, access_token_expires_at, 
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        userId,
        sellerId,
        storeName,
        marketplaceId,
        this.encryptToken(tokenResponse.access_token),
        this.encryptToken(tokenResponse.refresh_token),
        expiresAt.toISOString(),
        EBAY_ACCOUNT_STATUS.ACTIVE,
      ]
    );

    const account = accounts[0];
    this.logger.log(
      `eBay account created successfully: ${account.id} for user: ${userId}, marketplace: ${marketplaceId}`
    );

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
      items: accounts.map((account) => this.mapToPublicDto(account)),
      total: accounts.length,
    };
  }

  /**
   * Create a listing on eBay (AddItem API)
   */
  /**
   * Create a listing on eBay using REST Inventory API
   * This is the modern replacement for XML-based trading API
   */
  async createListingWithRest(
    userId: string,
    productId: string,
    listingData: ListingCreationData,
    policies: { paymentId: string; shippingId: string; returnId: string },
    asin: string
  ): Promise<EbayListingCreationResult> {
    this.logger.log(`Creating eBay listing (REST) for user ${userId}, product ${productId}`);

    // 1. Get user's active eBay account
    const account = await this.getActiveAccount(userId);
    if (!account) {
      throw new Error('No active eBay account found for user');
    }

    // 2. Get fresh access token
    const accessToken = await this.getAccessToken(account);

    // 3. Determine marketplace config
    const marketplaceId = account.marketplace_id as EbayMarketplaceId;
    const config = EBAY_MARKETPLACE_CONFIG[marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;

    // 4. Generate SKU (e.g. ASIN-NEW-timestamp for sandbox to avoid conflicts)
    const isSandbox = this.configService.get('EBAY_ENVIRONMENT') === 'sandbox';
    const sku = isSandbox ? `${asin}-NEW-${Date.now().toString().slice(-6)}` : `${asin}-NEW`;

    // 5. Ensure Inventory Location Exists
    const merchantLocationKey = 'default';
    await this.ensureInventoryLocation(accessToken, merchantLocationKey, listingData, config);

    // 6. Resolve the category FIRST — item specifics are category-scoped, so
    //    the inventory item cannot be built correctly before it is known. (The
    //    old flow PUT the item once with a Brand-only aspect map before the
    //    category was resolved, which is how listings reached eBay with a
    //    near-empty specifics table.)
    const { categoryId, categoryName } = await this.taxonomyService.resolveCategory({
      accessToken,
      marketplaceId,
      categoryTreeId: config.siteId,
      asin,
      brand: listingData.brand,
      title: listingData.title,
      amazonCategory: listingData.category,
    });
    this.logger.log(`Category for "${listingData.title}": ${categoryName} (${categoryId})`);

    // 7. Fetch full aspect metadata (names + required + allowed values) for it.
    const categoryAspects = await this.taxonomyService.getCategoryAspects({
      accessToken,
      marketplaceId,
      categoryTreeId: config.siteId,
      categoryId,
    });
    this.logger.log(
      `Category ${categoryId}: ${categoryAspects.length} aspects, ` +
        `${categoryAspects.filter((a) => a.required).length} required`
    );
    const forcedAspectNames: string[] = [];
    let resolution = await this.aspectResolver.resolve({
      marketplaceId,
      categoryId,
      categoryAspects,
      forcedAspectNames,
      product: {
        title: listingData.title,
        brand: listingData.brand,
        specs: listingData.specs,
        features: listingData.features,
        identifiers: listingData.identifiers,
      },
    });

    // Self-healing loop: when a publish fails on a missing item specific, the
    // aspect name is added to `forcedAspectNames` and the item is rebuilt. The
    // second failure for the same aspect throws — the category constrains it to
    // values we cannot derive, and retrying cannot change that.
    let listingId = '';
    let attempts = 0;
    // With the terminal fallback in place a required aspect is never empty, so
    // a third publish attempt cannot succeed where the second failed - it only
    // multiplies eBay call volume for a listing that is already broken.
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      let currentOfferId: string | undefined;
      try {
        // 8. Create or Replace Inventory Item (PUT) with category-aware aspects
        await this.createOrReplaceInventoryItem(accessToken, sku, listingData, config, resolution);

        // 10. Create Offer (POST)
        currentOfferId = await this.createOffer(
          accessToken,
          sku,
          listingData,
          policies,
          config,
          marketplaceId,
          categoryId,
          merchantLocationKey
        );

        // 11. Publish Offer (POST)
        listingId = await this.publishOffer(accessToken, currentOfferId);

        this.logger.log(`Successfully created eBay listing (REST): ${listingId}`);
        // Teach the platform what worked in this category so the next listing
        // resolves the same aspects without re-deriving them.
        this.aspectResolver.recordPublishSuccess(marketplaceId, categoryId, resolution);
        return { listingId, categoryName, categoryId, aspectResolution: resolution };
      } catch (error: unknown) {
        attempts++;

        // Check for "Missing Item Specific" error (25002 with specific message pattern)
        // Error format: "The item specific Screen Size is missing."
        // Parameters usually contain the missing key in value or explicitly.
        const axiosErr = isAxiosErrorWithData(error) ? error : null;
        const errors = axiosErr?.response?.data?.errors || [];
        const missingAspectError = errors.find(
          (e: { errorId?: number; message?: string }) =>
            e.errorId === 25002 && (e.message?.includes('item specific') ?? false)
        );

        if (missingAspectError && attempts < maxAttempts) {
          // Try to extract the missing aspect name
          // Usually param '2' holds the key name, or we extract from message
          let missingKey = missingAspectError.parameters?.find((p: { name?: string }) => p.name === '2')?.value; // Verified from logs

          if (!missingKey) {
            // Fallback extraction from message: "The item specific X is missing."
            const msgMatch = missingAspectError.message?.match(/item specific (.*?) is missing/);
            if (msgMatch) {
              missingKey = msgMatch[1];
            }
          }

          if (missingKey) {
            // Already forced once and eBay still rejects it: the category
            // constrains this aspect to values we cannot derive. Retrying is
            // guaranteed to fail, so surface an actionable error on the job item
            // instead of burning four more publish attempts.
            if (forcedAspectNames.includes(missingKey)) {
              throw new Error(
                `eBay requires the item specific "${missingKey}" for category ${categoryId} ` +
                  `and no value could be derived from the Amazon product data. ` +
                  `Set it manually on the listing, or choose a different category.`
              );
            }

            this.logger.warn(
              `Publish failed due to missing aspect '${missingKey}'. Auto-filling and retrying... (Attempt ${attempts})`
            );
            forcedAspectNames.push(missingKey);
            resolution = await this.aspectResolver.resolve({
              marketplaceId,
              categoryId,
              categoryAspects,
              forcedAspectNames,
              product: {
                title: listingData.title,
                brand: listingData.brand,
                specs: listingData.specs,
                features: listingData.features,
                identifiers: listingData.identifiers,
              },
            });
            continue; // Retry loop
          }
        }

        // eBay rejected a VALUE we sent (as opposed to reporting one missing).
        // Demote it so the next listing in this category stops repeating it.
        const invalidAspectError = errors.find(
          (e: { message?: string }) => e.message?.includes('has an invalid value') ?? false
        );
        if (invalidAspectError) {
          const match = invalidAspectError.message?.match(/^(.*?) has an invalid value of "(.*?)"/);
          if (match) {
            this.aspectResolver.recordAspectRejection(marketplaceId, categoryId, match[1], match[2]);
          }
        }

        // Handle "System error" on publish — cleanup orphan offer and retry
        const systemError = errors.find(
          (e: { errorId?: number; message?: string }) =>
            e.errorId === 25002 && (e.message?.includes('System error') ?? false)
        );

        if (systemError && currentOfferId && attempts < maxAttempts) {
          this.logger.warn(
            `Publish failed with system error. Deleting orphan offer ${currentOfferId} and retrying... (Attempt ${attempts})`
          );
          await this.deleteOffer(accessToken, currentOfferId);
          continue;
        }

        // If not a recoverable error, throw original error
        throw error;
      }
    }

    // Every attempt ended in `continue` and eBay never returned a listing id.
    // Returning that as success wrote an ACTIVE listing row with an empty
    // `ebay_item_id` - a listing that does not exist on eBay, can never be
    // matched to an order, and blocks re-listing the ASIN.
    throw new ListingPublishExhaustedError(categoryId, forcedAspectNames, attempts);
  }

  /**
   * Create or Replace Inventory Item (REST API)
   */
  private async createOrReplaceInventoryItem(
    accessToken: string,
    sku: string,
    data: ListingCreationData,
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US'],
    resolution: AspectResolution
  ): Promise<void> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/inventory_item/${sku}`;

    // Item specifics were resolved once for this attempt by AspectResolverService:
    // the category's declared aspects (value-constrained, every required one
    // filled) plus the product's remaining attributes as custom specifics.
    const aspects = resolution.aspects;

    this.logger.log(
      `Item specifics for ${sku}: ${Object.keys(aspects).length} total ` +
        `(${summarizeAspectLayers(resolution)})`
    );

    const condition = resolveEbayCondition(data.title);

    // Catalog identifiers: this is what lets eBay match the listing to its own
    // catalog product, which auto-enriches item specifics and search metadata.
    // GTINs are check-digit validated — a malformed one fails the whole publish.
    const upc = normalizeGtin(data.identifiers?.upc);
    const ean = normalizeGtin(data.identifiers?.ean);
    // A GTIN is not a part number: eBay fails the publish with "MPN has an
    // invalid value" when a barcode lands here (Amazon puts the UPC in
    // `partNumber` for most grocery ASINs). Omitting MPN is explicitly allowed.
    const rawMpn = data.identifiers?.mpn?.trim();
    const brandText = data.brand?.trim().toLowerCase();
    const usableMpn =
      rawMpn && !isValidGtin(rawMpn) && (!brandText || rawMpn.toLowerCase() !== brandText)
        ? rawMpn
        : undefined;
    // eBay validates Brand and MPN as a PAIR (`<BrandMPN>`): sending a brand with
    // no MPN fails with "Input data for tag <BrandMPN> is invalid or missing".
    // Its documented answer for "this product has no part number" is the literal
    // non-value, which is also what the item-specific fallback uses.
    const mpn = usableMpn ?? (data.brand?.trim() ? EBAY_NOT_APPLICABLE : undefined);

    const payload = {
      availability: {
        shipToLocationAvailability: {
          quantity: data.quantity || 1,
        },
      },
      condition: condition,
      product: {
        title: data.title ? data.title.substring(0, EBAY_TITLE_MAX_LENGTH) : 'New Product',
        // Inventory-item description is catalog metadata capped at 4,000 chars —
        // the buyer-visible copy is the offer's listingDescription (500,000).
        // Truncated at a tag boundary so a cut never leaves broken markup.
        description: data.description
          ? truncateHtml(data.description, EBAY_INVENTORY_DESCRIPTION_MAX_LENGTH)
          : '',
        aspects: aspects,
        ...(data.brand ? { brand: data.brand.substring(0, 65) } : {}),
        ...(mpn ? { mpn: mpn.substring(0, 65) } : {}),
        ...(upc ? { upc: [upc] } : {}),
        ...(ean ? { ean: [ean] } : {}),
        // Filter out null/empty URLs and ensure valid format
        // eBay requires at least one image, use placeholder if none available
        imageUrls: (() => {
          const validUrls = (data.imageUrls || []).filter(
            (url: string) => url && typeof url === 'string' && url.startsWith('http')
          );
          if (validUrls.length === 0) {
            this.logger.warn(`No valid images for SKU ${sku}, using placeholder`);
            return ['https://via.placeholder.com/600x600?text=No+Image+Available'];
          }
          return validUrls.slice(0, EBAY_MAX_IMAGES);
        })(),
      },
    };

    this.logger.debug(`Creating inventory item ${sku}. URL: ${url}`);
    this.logger.debug(`Payload for ${sku}: ${JSON.stringify(payload)}`);

    try {
      // 429/5xx backoff on the create path too: one transient eBay 500 during a
      // bulk add used to burn a whole BullMQ attempt for that ASIN.
      await this.withRateLimitRetry(() =>
        axios.put(url, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
          },
        })
      );
    } catch (e: unknown) {
      const axiosErr = isAxiosErrorWithData(e) ? e : null;
      this.logger.error(
        `Create inventory item failed for ${sku}. Response: ${JSON.stringify(
          axiosErr?.response?.data || getErrorMessage(e)
        )}`
      );
      throw e;
    }
  }

  /**
   * Create Offer (REST API)
   */
  private async createOffer(
    accessToken: string,
    sku: string,
    data: ListingCreationData,
    policies: { paymentId: string; shippingId: string; returnId: string },
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US'],
    marketplaceId: string,
    categoryId: string,
    merchantLocationKey: string
  ): Promise<string> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer`;

    const payload = {
      sku: sku,
      marketplaceId: marketplaceId,
      format: 'FIXED_PRICE',
      availableQuantity: data.quantity || 1,
      categoryId: categoryId,
      // Buyer-visible description: full template HTML (eBay allows 500,000).
      listingDescription: data.description ? truncateHtml(data.description, EBAY_DESCRIPTION_MAX_LENGTH) : '',
      listingPolicies: {
        fulfillmentPolicyId: policies.shippingId,
        paymentPolicyId: policies.paymentId,
        returnPolicyId: policies.returnId,
      },
      merchantLocationKey: merchantLocationKey,
      pricingSummary: {
        price: {
          currency: config.currency,
          value: data.price.toString(),
        },
      },
      quantityLimitPerBuyer: 5,
    };

    this.logger.debug(`Creating offer for ${sku}. URL: ${url}, Payload: ${JSON.stringify(payload)}`);

    try {
      const response = await this.withRateLimitRetry(() =>
        axios.post<EbayOfferResponse>(url, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
          },
        })
      );
      return response.data.offerId;
    } catch (e: unknown) {
      const axiosErr = isAxiosErrorWithData(e) ? e : null;
      this.logger.error(`Create offer failed for ${sku}`, axiosErr?.response?.data || getErrorMessage(e));
      if (axiosErr?.response?.data?.errors) {
        // Handle specific errors like "Location not found"
        this.logger.error('Create offer failed details', JSON.stringify(axiosErr.response.data));

        // Handle "Offer entity already exists" (Error 25002)
        const existingOfferError = axiosErr.response.data.errors.find(
          (err: { errorId?: number }) => err.errorId === 25002
        );
        if (existingOfferError) {
          const offerIdParam = existingOfferError.parameters?.find((p: { name?: string }) => p.name === 'offerId');
          if (offerIdParam?.value) {
            this.logger.warn(`Offer already exists for SKU ${sku}. Using existing offer ID: ${offerIdParam.value}`);
            // Update the existing offer to ensure it has latest price/quantity
            await this.updateOffer(accessToken, offerIdParam.value, payload, config);
            return offerIdParam.value;
          }
        }
      }
      throw e;
    }
  }

  /**
   * Update existing offer
   */
  private async updateOffer(
    accessToken: string,
    offerId: string,
    payload: Record<string, unknown>,
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US']
  ): Promise<void> {
    try {
      const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offerId}`;
      await axios.put(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
        },
      });
      this.logger.log(`Updated existing offer ${offerId}`);
    } catch (e: unknown) {
      const axiosErr = isAxiosErrorWithData(e) ? e : null;
      this.logger.warn(`Failed to update existing offer ${offerId}`, axiosErr?.response?.data || getErrorMessage(e));
      // Non-fatal, return the original ID so we can try to publish
    }
  }

  /**
   * Delete an offer (cleanup orphan offers before retry)
   */
  private async deleteOffer(accessToken: string, offerId: string): Promise<void> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offerId}`;
    try {
      await axios.delete(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      this.logger.log(`Deleted orphan offer ${offerId}`);
    } catch (e: unknown) {
      this.logger.warn(`Failed to delete offer ${offerId}: ${getErrorMessage(e)}`);
    }
  }

  /**
   * Publish Offer (REST API)
   */
  private async publishOffer(accessToken: string, offerId: string): Promise<string> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offerId}/publish`;

    this.logger.debug(`Publishing offer ${offerId}. URL: ${url}`);

    try {
      const response = await this.withRateLimitRetry(() =>
        axios.post<EbayPublishResponse>(
          url,
          {},
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      return response.data.listingId;
    } catch (e: unknown) {
      const axiosErr = isAxiosErrorWithData(e) ? e : null;
      const errorData = axiosErr?.response?.data;

      this.logger.error(
        `Publish offer failed for ${offerId}. Status: ${axiosErr?.response?.status || 'Unknown'}. ` +
          `Response: ${JSON.stringify(errorData, null, 2)}`
      );

      throw e;
    }
  }

  /**
   * Ensure Inventory Location exists
   */
  private async ensureInventoryLocation(
    accessToken: string,
    merchantLocationKey: string,
    data: ListingCreationData,
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US']
  ): Promise<void> {
    // Try retrieval first to avoid overwriting if exists
    try {
      await axios.get(
        `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/location/${merchantLocationKey}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return; // Exists
    } catch (e: unknown) {
      const axiosErr = isAxiosErrorWithData(e) ? e : null;
      if (axiosErr?.response?.status !== 404) {
        throw e;
      }
    }

    // Create if 404
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/location/${merchantLocationKey}`;
    const payload = {
      name: 'Default Warehouse',
      location: {
        address: {
          addressLine1: data.address1 || 'Use Store Address',
          city: data.location,
          stateOrProvince: data.location,
          postalCode: data.postalCode,
          country: data.country || config.countryCode,
        },
      },
      merchantLocationStatus: 'ENABLED',
      locationTypes: ['STORE'],
    };

    this.logger.debug(
      `Creating inventory location ${merchantLocationKey}. URL: ${url}, Payload: ${JSON.stringify(payload)}`
    );

    try {
      await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (e: unknown) {
      const axiosErr = isAxiosErrorWithData(e) ? e : null;
      this.logger.error(`Create inventory location failed`, axiosErr?.response?.data || getErrorMessage(e));
      throw e;
    }
  }

  /**
   * Get Suggested Category ID from eBay Taxonomy API
   */
  private async getSuggestedCategory(
    accessToken: string,
    data: Pick<ListingCreationData, 'title' | 'brand' | 'category'>,
    treeId: string
  ): Promise<{ categoryId: string; categoryName: string }> {
    // Brand + the Amazon category are strong signals eBay's matcher uses; the
    // title alone lands generic items in "Other" far more often.
    const query = [data.brand, data.title, data.category]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
      .slice(0, 350);

    const cacheKey = `${treeId}:${query}`;
    const cached = this.categorySuggestionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { categoryId: cached.categoryId, categoryName: cached.categoryName };
    }

    try {
      const url = `${this.configService.get(
        'EBAY_REST_API_URL'
      )}/commerce/taxonomy/v1/category_tree/${treeId}/get_category_suggestions?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept-Language': 'en-US', // Taxonomy usually EN
        },
      });

      // Return first suggestion's leaf category
      interface CategorySuggestionResponse {
        categorySuggestions?: Array<{
          category: { categoryId: string; categoryName?: string };
        }>;
      }
      const suggestions = (response.data as CategorySuggestionResponse | undefined)?.categorySuggestions;
      if (suggestions && suggestions.length > 0) {
        const leaf = suggestions[0].category;
        const resolved = {
          categoryId: leaf.categoryId,
          categoryName: leaf.categoryName || 'Unknown Category',
        };
        this.categorySuggestionCache.set(cacheKey, {
          ...resolved,
          expiresAt: Date.now() + CATEGORY_ASPECT_CACHE_TTL_MS,
        });
        return resolved;
      }

      // Category 1 is eBay's ROOT, not a listable leaf. Returning it (the old
      // behaviour) guaranteed a later publish failure whose message never
      // mentioned the category, so the real cause stayed invisible.
      throw new CategoryResolutionError(query);
    } catch (e) {
      if (e instanceof CategoryResolutionError) {
        throw e;
      }
      this.logger.error('Failed to get suggested category', e);
      throw new CategoryResolutionError(query);
    }
  }

  /**
   * Full item-aspect metadata for a category (Taxonomy API).
   *
   * We used to keep only the NAMES of REQUIRED aspects and fill each with
   * "Unknown". The value constraints are the important part: a SELECTION_ONLY
   * aspect rejects free text, and the recommended aspects are exactly the item
   * specifics buyers filter on. Cached per category — the taxonomy is static
   * for days and a bulk add would otherwise call it once per ASIN.
   */
  private async getItemAspectsForCategory(
    accessToken: string,
    categoryId: string,
    treeId: string
  ): Promise<CategoryAspect[]> {
    const cacheKey = `${treeId}:${categoryId}`;
    const cached = this.categoryAspectCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.aspects;
    }

    try {
      const url = `${this.configService.get(
        'EBAY_REST_API_URL'
      )}/commerce/taxonomy/v1/category_tree/${treeId}/get_item_aspects_for_category?category_id=${categoryId}`;
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Accept-Language': 'en-US',
        },
      });

      interface AspectValue {
        localizedValue?: string;
      }
      interface AspectData {
        localizedAspectName: string;
        aspectConstraint?: {
          aspectRequired?: boolean;
          aspectUsage?: string;
          aspectMode?: string;
          itemToAspectCardinality?: string;
          aspectMaxLength?: number;
          aspectDataType?: string;
        };
        aspectValues?: AspectValue[];
      }
      interface AspectsResponse {
        aspects?: AspectData[];
      }

      const aspectsData = response.data as AspectsResponse | undefined;
      const aspects: CategoryAspect[] = (aspectsData?.aspects ?? []).map((aspect) => ({
        name: aspect.localizedAspectName,
        required:
          aspect.aspectConstraint?.aspectRequired === true ||
          aspect.aspectConstraint?.aspectUsage === 'REQUIRED' ||
          aspect.aspectConstraint?.aspectMode === 'REQUIRED',
        selectionOnly: aspect.aspectConstraint?.aspectMode === 'SELECTION_ONLY',
        multiValue: aspect.aspectConstraint?.itemToAspectCardinality === 'MULTI',
        maxLength: aspect.aspectConstraint?.aspectMaxLength,
        values: (aspect.aspectValues ?? [])
          .map((value) => value.localizedValue)
          .filter((value): value is string => Boolean(value)),
      }));

      this.categoryAspectCache.set(cacheKey, {
        aspects,
        expiresAt: Date.now() + CATEGORY_ASPECT_CACHE_TTL_MS,
      });
      return aspects;
    } catch (e) {
      // An empty aspect list is not a benign default: it publishes a Brand-only
      // listing that then fails on every required item specific in turn. Serve a
      // stale cached copy when one exists; otherwise fail loudly.
      this.logger.warn(`Failed to fetch aspects for category ${categoryId}`, e);
      const stale = this.categoryAspectCache.get(cacheKey);
      if (stale) {
        this.logger.warn(`Serving stale aspect metadata for category ${categoryId}`);
        return stale.aspects;
      }
      throw new CategoryAspectsUnavailableError(categoryId);
    }
  }

  /**
   * DEPRECATED: XML-based list creation
   * Kept for reference but not used in REST-first flow
   */
  async createListing(
    userId: string,
    productId: string,
    settingsGroupId: string,
    policies: { paymentId: string; shippingId: string; returnId: string },
    listingData?: ListingCreationData
  ): Promise<string> {
    // ... Legacy implementation ...
    this.logger.warn('Use createListingWithRest instead of createListing');
    const data = listingData || {
      title: 'Product',
      description: '',
      brand: '',
      price: 0,
      currency: 'USD',
      country: 'US',
      quantity: 1,
      imageUrls: [],
    };
    const result = await this.createListingWithRest(userId, productId, data, policies, 'UNKNOWN');
    return result.listingId;
  }

  /**
   * Run an eBay REST call with exponential backoff on 429 / 5xx.
   * Honours `Retry-After` (delta-seconds) when eBay sends it; otherwise backs
   * off 500ms → 1s → 2s. Non-transient errors (4xx other than 429) throw as-is.
   */
  private async withRateLimitRetry<T>(request: () => Promise<T>, maxAttempts = 4): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await request();
      } catch (error: unknown) {
        lastError = error;
        if (!isRetryableAxiosError(error) || !isTransientStatus(error.response!.status!)) {
          throw error;
        }
        if (attempt === maxAttempts) {
          break;
        }
        const status = error.response!.status!;
        const retryAfterMs = parseRetryAfterMs(error.response!.headers?.['retry-after']);
        const backoffMs = retryAfterMs ?? 500 * 2 ** (attempt - 1);
        this.logger.warn(`eBay API ${status} (attempt ${attempt}/${maxAttempts}) — backing off for ${backoffMs}ms`);
        await sleep(backoffMs);
      }
    }
    throw lastError;
  }

  /**
   * Update price and stock for an existing listing using REST API
   */
  async updatePriceAndStock(
    userId: string,
    sku: string,
    price: number,
    quantity: number,
    ebayListingId: string // eBay Item ID
  ): Promise<void> {
    this.logger.log(`Updating price and stock for user ${userId}, SKU ${sku}, Listing ${ebayListingId}`);

    const account = await this.getActiveAccount(userId);
    if (!account) {
      throw new Error('No active eBay account');
    }

    const accessToken = await this.getAccessToken(account);
    const marketplaceId = account.marketplace_id as EbayMarketplaceId;
    const config = EBAY_MARKETPLACE_CONFIG[marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;

    // 1. Update Inventory Item (Quantity)
    // We need to fetch current inventory item first or just do a partial PUT?
    // eBay Inventory API PUT /inventory_item/{sku} requires full payload.
    // However, we can use /bulk_update_price_quantity or just update the offer.

    // For simplicity and following the existing pattern, let's update the offer price
    // and inventory quantity separately.

    // Update Price via Offer
    // We need the offerId. We can find it by SKU or store it in DB.
    // Since we don't store offerId, we'll fetch offers for the SKU.
    const offersUrl = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer?sku=${sku}`;
    interface OffersData {
      offers?: Array<Record<string, unknown>>;
    }
    const offersResponse = await this.withRateLimitRetry(() =>
      axios.get<OffersData>(offersUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    const offer = offersResponse.data?.offers?.find((o) => o.marketplaceId === marketplaceId);
    if (!offer) {
      this.logger.warn(`No offer found for SKU ${sku} on ${marketplaceId}. Cannot update price.`);
    } else {
      const updateOfferUrl = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${String(
        offer.offerId
      )}`;
      const payload: Record<string, unknown> = {
        ...offer,
        availableQuantity: quantity,
        pricingSummary: {
          price: {
            currency: config.currency,
            value: price.toFixed(2),
          },
        },
      };
      // Remove fields that shouldn't be in PUT
      delete payload.offerId;
      delete payload.listing;
      delete payload.status;

      await this.withRateLimitRetry(() =>
        axios.put(updateOfferUrl, payload, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
          },
        })
      );
    }

    // Update Quantity via Inventory Item
    const inventoryUrl = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/inventory_item/${sku}`;
    // Fetch existing to get full data (required for PUT)
    interface InventoryItemResponse {
      availability?: {
        shipToLocationAvailability?: { quantity?: number };
      };
    }
    const invResponse = await this.withRateLimitRetry(() =>
      axios.get<InventoryItemResponse>(inventoryUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
    );

    const inventoryItem = invResponse.data;
    if (inventoryItem?.availability?.shipToLocationAvailability) {
      inventoryItem.availability.shipToLocationAvailability.quantity = quantity;
    }

    await this.withRateLimitRetry(() =>
      axios.put(inventoryUrl, inventoryItem, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
        },
      })
    );

    this.logger.log(`Price and stock updated for eBay listing ${ebayListingId}`);
  }

  /**
   * Get active eBay account ID for user (Public helper)
   */
  async getActiveAccountId(userId: string): Promise<string | null> {
    const account = await this.getActiveAccount(userId);
    return account ? account.id : null;
  }

  /**
   * Get a fresh access token for a user's active eBay account (Public helper)
   * Used by OrderSyncService and other services that need direct API access
   */
  async getActiveAccountAccessToken(userId: string): Promise<string | null> {
    const account = await this.getActiveAccount(userId);
    if (!account) {
      return null;
    }
    return this.getAccessToken(account);
  }

  /**
   * Get a valid access token for a SPECIFIC eBay account (by id).
   * Used by BuyerMessagingProvider and other per-account callers.
   * Refreshes if expiring within 5 minutes (delegates to getAccessToken).
   */
  async getAccountAccessToken(accountId: string): Promise<string> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE id = $1`,
      [accountId],
    );
    if (!accounts[0]) {
      throw new NotFoundException(`eBay account ${accountId} not found`);
    }
    return this.getAccessToken(accounts[0]);
  }

  /**
   * Get active eBay account for user
   */
  private async getActiveAccount(userId: string): Promise<EbayAccountEntity | null> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE user_id = $1 AND status = $2 LIMIT 1`,
      [userId, EbayAccountStatus.ACTIVE]
    );
    return accounts[0] || null;
  }

  /**
   * Ensure we have a valid access token
   */
  private async getAccessToken(account: EbayAccountEntity): Promise<string> {
    // Check if token is expired (with 5 min buffer)
    const now = new Date();
    const expiresAt = new Date(account.access_token_expires_at);

    if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
      return this.decryptToken(account.access_token);
    }

    this.logger.log(`Access token for account ${account.id} expired. Refreshing...`);
    const tokenResponse = await this.oauthService.refreshAccessToken(
      this.decryptToken(account.refresh_token)
    );

    const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await this.databaseService.query(
      `UPDATE ebay_accounts SET access_token = $1, access_token_expires_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [this.encryptToken(tokenResponse.access_token), newExpiresAt.toISOString(), account.id]
    );

    return tokenResponse.access_token;
  }

  /**
   * Build eBay AddItem XML request
   */
  private buildAddItemXml(
    data: Record<string, unknown>,
    policies: { paymentId: string; shippingId: string; returnId: string }
  ): string {
    const title = data.title as string | undefined;
    const description = data.description as string | undefined;
    const price = data.price as number | undefined;
    const quantity = data.quantity as number | undefined;
    const imageUrls = data.imageUrls as string[] | undefined;
    const currency = data.currency as string | undefined;

    // Basic XML structure for AddItem
    // Note: In a real app, we'd use a robust XML builder and handle all fields
    return `<?xml version="1.0" encoding="utf-8"?>
<AddItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${this.escapeXml(title || 'Product')}</Title>
    <Description><![CDATA[${description || ''}]]></Description>
    <PrimaryCategory>
      <CategoryID>1</CategoryID> <!-- TODO: Category Mapping -->
      </PrimaryCategory>
      <StartPrice>${price || 0}</StartPrice>
      <CategoryMappingAllowed>true</CategoryMappingAllowed>
      <ConditionID>1000</ConditionID> <!-- New -->
      <Currency>${currency}</Currency>
      <Country>${String(data.country || 'US')}</Country>
      <Location>${String(data.country || 'US')}</Location>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PaymentMethods>PayPal</PaymentMethods>
    <!-- Payment handled via payment policy -->
    <PictureDetails>
      ${(imageUrls || []).map((url: string) => `<PictureURL>${url}</PictureURL>`).join('\n      ')}
    </PictureDetails>
    <Quantity>${quantity || 1}</Quantity>
    <ReturnPolicy>
      <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
      <ReturnsWithinOption>Days_30</ReturnsWithinOption>
      <RefundOption>MoneyBack</RefundOption>
      <Description>Returns accepted within 30 days.</Description>
      <ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>
    </ReturnPolicy>
    <SellerProfiles>
      <SellerPaymentProfile>
        <PaymentProfileID>${policies.paymentId}</PaymentProfileID>
      </SellerPaymentProfile>
      <SellerShippingProfile>
        <ShippingProfileID>${policies.shippingId}</ShippingProfileID>
      </SellerShippingProfile>
      <SellerReturnProfile>
        <ReturnProfileID>${policies.returnId}</ReturnProfileID>
      </SellerReturnProfile>
    </SellerProfiles>
    <ShippingDetails>
      <ShippingServiceOptions>
        <ShippingServicePriority>1</ShippingServicePriority>
        <ShippingService>USPSFirstClass</ShippingService>
        <ShippingServiceCost>0.00</ShippingServiceCost>
      </ShippingServiceOptions>
    </ShippingDetails>
    <Site>US</Site>
  </Item>
</AddItemRequest>`;
  }

  /**
   * Execute AddItem call to eBay XML API
   */
  private async executeAddItem(accessToken: string, xml: string, marketplaceId: string): Promise<string> {
    const baseUrl = this.configService.get<string>('EBAY_XML_API_URL') || '';

    // Map marketplace to SiteID
    const siteIdMap: Record<string, string> = {
      EBAY_US: '0',
      EBAY_UK: '3',
      EBAY_DE: '77',
      EBAY_FR: '71',
      EBAY_IT: '101',
      EBAY_ES: '186',
    };
    const siteId = siteIdMap[marketplaceId] || '0';

    try {
      const response = await axios.post(baseUrl, xml, {
        headers: {
          'Content-Type': 'text/xml',
          'X-EBAY-API-SITEID': siteId,
          'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
          'X-EBAY-API-CALL-NAME': 'AddItem',
          'X-EBAY-API-IAF-TOKEN': accessToken,
        },
      });

      // Simple parsing logic for mock/initial version
      // In production, use fast-xml-parser
      const responseBody = response.data as string;
      if (responseBody.includes('<Ack>Success</Ack>') || responseBody.includes('<Ack>Warning</Ack>')) {
        const match = responseBody.match(/<ItemID>(\d+)<\/ItemID>/);
        return match ? match[1] : `EBAY-MOCK-${Date.now()}`;
      } else {
        const errorMatch = responseBody.match(/<LongMessage>(.*?)<\/LongMessage>/);
        throw new Error(errorMatch ? errorMatch[1] : 'Unknown eBay API error');
      }
    } catch (error: unknown) {
      const axiosErr = isAxiosErrorWithData(error) ? error : null;
      this.logger.error('eBay API request failed', axiosErr?.response?.data || getErrorMessage(error));
      throw error;
    }
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&"']/g, (c) => {
      switch (c) {
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '&':
          return '&amp;';
        case '"':
          return '&quot;';
        case "'":
          return '&apos;';
        default:
          return c;
      }
    });
  }

  /**
   * Get business policies from eBay for the user's connected account
   */
  async getBusinessPolicies(userId: string) {
    this.logger.log(`Fetching business policies for user ${userId}`);

    // 1. Get user's active eBay account
    const account = await this.getActiveAccount(userId);
    if (!account) {
      this.logger.warn(`No active eBay account for user ${userId} to fetch policies`);
      return [];
    }

    // 2. Get fresh access token
    const accessToken = await this.getAccessToken(account);
    const marketplaceId = account.marketplace_id;

    try {
      // 3. Fetch all 3 types of policies
      const [fulfillment, payment, returns] = await Promise.all([
        this.fetchPoliciesFromEbay(accessToken, 'fulfillment_policy', marketplaceId),
        this.fetchPoliciesFromEbay(accessToken, 'payment_policy', marketplaceId),
        this.fetchPoliciesFromEbay(accessToken, 'return_policy', marketplaceId),
      ]);

      const allPolicies = [
        ...fulfillment.map((p: Record<string, unknown>) => ({
          id: String(p.fulfillmentPolicyId ?? ''),
          name: String(p.name ?? ''),
          type: 'shipping' as const,
          description: String(p.description ?? ''),
        })),
        ...payment.map((p: Record<string, unknown>) => ({
          id: String(p.paymentPolicyId ?? ''),
          name: String(p.name ?? ''),
          type: 'payment' as const,
          description: String(p.description ?? ''),
        })),
        ...returns.map((p: Record<string, unknown>) => ({
          id: String(p.returnPolicyId ?? ''),
          name: String(p.name ?? ''),
          type: 'return' as const,
          description: String(p.description ?? ''),
        })),
      ];

      this.logger.log(`Fetched ${allPolicies.length} business policies from eBay for ${userId}`);
      return allPolicies;
    } catch (error: unknown) {
      this.logger.error(`Failed to fetch business policies from eBay: ${getErrorMessage(error)}`);
      // Fallback to empty if eBay API fails (e.g. business policies not enabled on account)
      return [];
    }
  }

  /**
   * Withdraw an offer on eBay (ends the active listing)
   */
  async withdrawOffer(userId: string, ebayItemId: string): Promise<void> {
    this.logger.log(`Withdrawing offer for listing ID: ${ebayItemId}`);

    // 1. Get user's active eBay account
    const account = await this.getActiveAccount(userId);
    if (!account) {
      throw new Error('No active eBay account found for user');
    }

    // 2. Get fresh access token
    const accessToken = await this.getAccessToken(account);

    // 3. Find the offer associated with this listing ID
    // Note: The ebay_item_id we store is the listingId return from publishOffer.
    // In Inventory API, we treat withdrawing an offer as ending the listing.
    // Since we don't store offerId, we might need to find it or use Trading API endItem.
    // However, if we know the SKU, we can get the offer.

    // For now, let's use the Trading API EndItem as it's more direct when you only have listingId
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${this.escapeXml(ebayItemId)}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`;

    const baseUrl = this.configService.get<string>('EBAY_XML_API_URL') || '';
    const siteIdMap: Record<string, string> = {
      EBAY_US: '0',
      EBAY_UK: '3',
      EBAY_DE: '77',
      EBAY_FR: '71',
      EBAY_IT: '101',
      EBAY_ES: '186',
    };
    const siteId = siteIdMap[account.marketplace_id] || '0';

    try {
      const response = await axios.post(baseUrl, xml, {
        headers: {
          'Content-Type': 'text/xml',
          'X-EBAY-API-SITEID': siteId,
          'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
          'X-EBAY-API-CALL-NAME': 'EndItem',
          'X-EBAY-API-IAF-TOKEN': accessToken,
        },
      });

      const responseBody = response.data as string;
      if (responseBody.includes('<Ack>Success</Ack>') || responseBody.includes('<Ack>Warning</Ack>')) {
        this.logger.log(`Successfully ended eBay item: ${ebayItemId}`);
      } else {
        const errorMatch = responseBody.match(/<LongMessage>(.*?)<\/LongMessage>/);
        this.logger.error(`Failed to end eBay item ${ebayItemId}: ${errorMatch ? errorMatch[1] : 'Unknown error'}`);
        // If item is already ended, skip error
        if (responseBody.includes('291') || responseBody.includes('already ended')) {
          this.logger.warn(`Item ${ebayItemId} was already ended.`);
          return;
        }
        throw new Error(errorMatch ? errorMatch[1] : 'Unknown eBay API error');
      }
    } catch (error: unknown) {
      const axiosErr = isAxiosErrorWithData(error) ? error : null;
      this.logger.error(`eBay endItem failed for ${ebayItemId}`, axiosErr?.response?.data || getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Helper to fetch policies from specific eBay REST endpoint
   */
  private async fetchPoliciesFromEbay(
    accessToken: string,
    policyType: string,
    marketplaceId: string
  ): Promise<Record<string, unknown>[]> {
    const baseUrl = this.configService.get<string>('EBAY_REST_API_URL') || '';

    try {
      const response = await axios.get(`${baseUrl}/sell/account/v1/${policyType}?marketplace_id=${marketplaceId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // The response has a field like 'fulfillmentPolicies', 'paymentPolicies', etc.
      const policiesKey = policyType.split('_')[0] + 'Policies';
      const responseData = response.data as Record<string, unknown>;
      return (responseData[policiesKey] as Record<string, unknown>[]) || [];
    } catch (error: unknown) {
      const axiosErr = isAxiosErrorWithData(error) ? error : null;
      if (axiosErr?.response?.status === 404 || axiosErr?.response?.status === 403) {
        // Business policies might not be enabled on this account
        this.logger.warn(`Business policies (${policyType}) not accessible for account: ${getErrorMessage(error)}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Map entity to public DTO (safe for frontend - no tokens)
   */
  private mapToPublicDto(entity: EbayAccountEntity): EbayAccountPublicDto {
    return {
      id: entity.id,
      userId: entity.user_id,
      sellerId: entity.seller_id,
      storeName: entity.store_name,
      marketplaceId: entity.marketplace_id,
      status: entity.status,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }
}
