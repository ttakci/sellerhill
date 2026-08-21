import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EBAY_ACCOUNT_STATUS,
  EBAY_MARKETPLACE,
  EBAY_MARKETPLACE_CONFIG,
  EbayAccountStatus,
  SUPPORTED_EBAY_MARKETPLACES,
  type CreateEbayConnectUrlResponse,
  type EbayAccountPublicDto,
  type EbayMarketplaceId,
  type GetEbayAccountsResponse,
  type ListingCreationData,
  EbayListingApiModel,
} from '@repo/shared';
import axios from 'axios';

import { DatabaseService } from '../../common/database/database.service';
import { EncryptionUtil } from '../../common/utils/encryption.util';
import { BillingService } from '../billing/billing.service';

import { type AspectResolution, type CategoryAspect } from './aspect-builder';
import { AspectResolverService } from './aspect-resolver.service';
import { EbayOAuthService } from './ebay-oauth.service';
import { EbayTaxonomyService } from './ebay-taxonomy.service';
import { CategoryAspectsUnavailableError, CategoryResolutionError } from './ebay.errors';

/**
 * Prefix marking an encrypted-at-rest token value in `ebay_accounts`.
 * Legacy rows hold plaintext (no prefix) and are decrypt-passthrough until the
 * onModuleInit backfill re-encrypts them.
 */
const TOKEN_ENC_PREFIX = 'enc:';

/** eBay's category taxonomy changes on a release cadence, not per request. */
const CATEGORY_ASPECT_CACHE_TTL_MS = 60 * 60 * 1000;

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
    private readonly aspectResolver: AspectResolverService,
    private readonly billingService: BillingService
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
    // Server-side gate mirroring the frontend picker's allowlist: only
    // marketplaces actually offered today (see SUPPORTED_EBAY_MARKETPLACES)
    // can be connected, even if a stale client or manual API call requests
    // one of the marketplaces EBAY_MARKETPLACE_CONFIG already has data for.
    if (!SUPPORTED_EBAY_MARKETPLACES.includes(marketplace)) {
      throw new BadRequestException(`Unsupported eBay marketplace: ${marketplace}`);
    }
    this.logger.log(`Creating eBay connect URL for user ${userId}, marketplace: ${marketplace}`);

    const { url, state } = this.oauthService.generateConsentUrl(marketplace, userId);

    return { url, state };
  }

  /**
   * eBay's Trading (XML) API Site ID for a marketplace, read from the single
   * shared config (EBAY_MARKETPLACE_CONFIG) rather than a duplicated inline
   * map — this used to be redeclared independently at two call sites.
   */
  private resolveSiteId(marketplaceId: string): string {
    const config = EBAY_MARKETPLACE_CONFIG[marketplaceId as EbayMarketplaceId];
    return config?.siteId ?? EBAY_MARKETPLACE_CONFIG[EBAY_MARKETPLACE.US].siteId;
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

    // One free trial per eBay store, ever. Checked BEFORE the row is written so
    // a refused connect leaves nothing behind. See
    // BillingService.assertEbayStoreMayConnect for why the store, not the
    // email, is the thing being rationed.
    try {
      await this.billingService.assertEbayStoreMayConnect(userId, sellerId, marketplaceId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'billing.errors.ebayTrialAlreadyUsed') {
        throw new ConflictException(message);
      }
      // A billing-side outage must not block a legitimate connect. The ledger
      // is a fraud control, not a correctness invariant — failing open here
      // costs at most one extra trial, while failing closed would lock out
      // paying customers whenever billing is degraded.
      this.logger.warn(`eBay trial ledger check failed (allowing connect): ${message}`);
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
   * Everything a listing needs resolved BEFORE eBay is written to.
   *
   * The read half of a create: the batched path prepares 25 listings here and
   * then writes them with three calls instead of 75. It makes no write call
   * itself — only the location check and the (heavily cached) category and
   * aspect resolution — so it is safe to run per item while the writes are
   * shared. Both callers (the queue worker and draft publish) go through it.
   */
  async prepareListingDraft(
    userId: string,
    listingData: ListingCreationData,
    asin: string,
    ebayAccountId?: string
  ): Promise<{
    accountId: string;
    sku: string;
    merchantLocationKey: string;
    categoryId: string;
    categoryName: string;
    categoryAspects: CategoryAspect[];
    resolution: AspectResolution;
  }> {
    const account = ebayAccountId
      ? await this.getOwnedAccount(userId, ebayAccountId)
      : await this.getActiveAccount(userId);
    if (!account) {
      throw new Error('No active eBay account found for user');
    }

    const accessToken = await this.getAccessToken(account);
    const marketplaceId = account.marketplace_id;
    const config = EBAY_MARKETPLACE_CONFIG[marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;

    const merchantLocationKey = 'default';
    await this.ensureInventoryLocation(accessToken, merchantLocationKey, listingData, config);

    const { categoryId, categoryName } = await this.taxonomyService.resolveCategory({
      accessToken,
      marketplaceId,
      categoryTreeId: config.siteId,
      asin,
      brand: listingData.brand,
      title: listingData.title,
      amazonCategory: listingData.category,
      amazonCategoryPath: listingData.categoryPath,
    });

    const categoryAspects = await this.taxonomyService.getCategoryAspects({
      accessToken,
      marketplaceId,
      categoryTreeId: config.siteId,
      categoryId,
    });

    const resolution = await this.aspectResolver.resolve({
      marketplaceId,
      categoryId,
      categoryAspects,
      forcedAspectNames: [],
      product: {
        title: listingData.title,
        brand: listingData.brand,
        specs: listingData.specs,
        features: listingData.features,
        identifiers: listingData.identifiers,
      },
    });

    return {
      accountId: account.id,
      sku: this.buildSku(asin),
      merchantLocationKey,
      categoryId,
      categoryName,
      categoryAspects,
      resolution,
    };
  }

  /**
   * The listing's eBay SKU.
   *
   * Sandbox appends a timestamp because a sandbox account accumulates test
   * inventory and SKU collisions block the publish. That makes the sandbox SKU
   * NON-derivable after the fact, which is why `listings.sku` is persisted
   * (migration 067) rather than recomputed at every call site.
   */
  private buildSku(asin: string): string {
    return this.configService.get('EBAY_ENVIRONMENT') === 'sandbox'
      ? `${asin}-NEW-${Date.now().toString().slice(-6)}`
      : `${asin}-NEW`;
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

  async assertAccountOwnership(userId: string, accountId: string): Promise<void> {
    await this.getOwnedAccount(userId, accountId);
  }

  /**
   * Everything one eBay API call needs to be addressed to a specific store.
   *
   * A bulk call carries exactly ONE seller token and writes into ONE
   * marketplace, so batching has to group by account before it can group by
   * anything else. Resolving token + marketplace + currency together also
   * avoids the second `ebay_accounts` read that calling `getAccountAccessToken`
   * and then re-reading the row would cost on every batch.
   */
  async getAccountApiContext(accountId: string): Promise<{
    accessToken: string;
    marketplaceId: EbayMarketplaceId;
    currency: string;
    contentLanguage: string;
  }> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE id = $1 AND status = $2`,
      [accountId, EbayAccountStatus.ACTIVE]
    );
    const account = accounts[0];
    if (!account) {
      throw new NotFoundException(`Active eBay account ${accountId} not found`);
    }

    const marketplaceId = account.marketplace_id;
    const config = EBAY_MARKETPLACE_CONFIG[marketplaceId] || EBAY_MARKETPLACE_CONFIG.EBAY_US;

    return {
      accessToken: await this.getAccessToken(account),
      marketplaceId,
      currency: config.currency,
      contentLanguage: config.countryCode === 'US' ? 'en-US' : 'en-GB',
    };
  }

  /**
   * The account a listing must be pushed through.
   *
   * `listings.ebay_account_id` is nullable on rows created before migration 030
   * backfilled it, so this falls back to the user's active account — but unlike
   * the old `getActiveAccount(userId)` path it is deterministic (oldest account
   * first) instead of an unordered `LIMIT 1`, which could hand back a different
   * store on each call and reprice a listing through the wrong token.
   */
  async resolveListingAccountId(userId: string, listingAccountId: string | null): Promise<string | null> {
    if (listingAccountId) {
      return listingAccountId;
    }
    const accounts = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM ebay_accounts
       WHERE user_id = $1 AND status = $2
       ORDER BY created_at ASC, id ASC
       LIMIT 1`,
      [userId, EbayAccountStatus.ACTIVE]
    );
    return accounts[0]?.id ?? null;
  }

  private async getOwnedAccount(userId: string, accountId: string): Promise<EbayAccountEntity> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE id = $1 AND user_id = $2 AND status = $3`,
      [accountId, userId, EbayAccountStatus.ACTIVE]
    );
    if (!accounts[0]) {
      throw new NotFoundException(`Active eBay account ${accountId} not found`);
    }
    return accounts[0];
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

  async discoverActiveListings(accountId: string): Promise<Array<{
    ebayItemId: string;
    sku?: string;
    title: string;
    price: number;
    quantity: number;
    quantitySold: number;
    imageUrl?: string;
    marketplaceId: string;
    apiModel: EbayListingApiModel;
  }>> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE id = $1`,
      [accountId]
    );
    const account = accounts[0];
    if (!account) {
      throw new NotFoundException(`eBay account ${accountId} not found`);
    }
    const accessToken = await this.getAccessToken(account);
    const baseUrl = this.configService.get<string>('EBAY_XML_API_URL') || '';
    const discovered: Array<{ ebayItemId: string; sku?: string; title: string; price: number; quantity: number; quantitySold: number; imageUrl?: string; marketplaceId: string; apiModel: EbayListingApiModel }> = [];
    let page = 1;
    let totalPages = 1;

    do {
      const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <ErrorLanguage>en_US</ErrorLanguage><WarningLevel>High</WarningLevel>
  <ActiveList><Include>true</Include><Pagination><EntriesPerPage>200</EntriesPerPage><PageNumber>${page}</PageNumber></Pagination></ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
      const response = await this.withRateLimitRetry(() => axios.post<string>(baseUrl, xml, { headers: {
        'Content-Type': 'text/xml', 'X-EBAY-API-SITEID': this.resolveSiteId(account.marketplace_id),
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967', 'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
        'X-EBAY-API-IAF-TOKEN': accessToken,
      }}));
      const body = response.data;
      const pages = body.match(/<TotalNumberOfPages>(\d+)<\/TotalNumberOfPages>/)?.[1];
      totalPages = pages ? Number(pages) : 1;
      const itemBlocks = body.match(/<Item>[^]*?<\/Item>/g) ?? [];
      const value = (block: string, tag: string): string | undefined =>
        block.match(new RegExp(`<${tag}>([^]*?)<\\/${tag}>`))?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      for (const block of itemBlocks) {
        const ebayItemId = value(block, 'ItemID');
        if (!ebayItemId) {continue;}
        const quantity = Number(value(block, 'Quantity') ?? 0);
        const quantitySold = Number(value(block, 'QuantitySold') ?? 0);
        discovered.push({
          ebayItemId,
          sku: value(block, 'SKU'),
          title: value(block, 'Title') ?? ebayItemId,
          price: Number(value(block, 'CurrentPrice') ?? value(block, 'StartPrice') ?? 0),
          quantity: Math.max(0, quantity - quantitySold),
          quantitySold,
          imageUrl: value(block, 'GalleryURL'),
          marketplaceId: account.marketplace_id,
          apiModel: block.includes('<InventoryTrackingMethod>SKU</InventoryTrackingMethod>')
            ? EbayListingApiModel.INVENTORY : EbayListingApiModel.LEGACY,
        });
      }
      page++;
    } while (page <= totalPages);
    return discovered;
  }

  async migrateLegacyListing(accountId: string, ebayItemId: string): Promise<void> {
    const accessToken = await this.getAccountAccessToken(accountId);
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/bulk_migrate_listing`;
    const response = await this.withRateLimitRetry(() => axios.post(url, { requests: [{ listingId: ebayItemId }] }, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    }));
    const result = (response.data as { responses?: Array<{ statusCode?: number; errors?: Array<{ message?: string }> }> }).responses?.[0];
    if (!result || (result.statusCode !== undefined && result.statusCode >= 400)) {
      throw new Error(result?.errors?.map((error) => error.message).filter(Boolean).join('; ') || 'eBay listing migration failed');
    }
  }

  async getBusinessPolicies(userId: string) {
    const account = await this.getActiveAccount(userId);
    if (!account) {return [];}
    const accessToken = await this.getAccessToken(account);
    const marketplaceId = account.marketplace_id;
    try {
      const [fulfillment, payment, returns] = await Promise.all([
        this.fetchPoliciesFromEbay(accessToken, 'fulfillment_policy', marketplaceId),
        this.fetchPoliciesFromEbay(accessToken, 'payment_policy', marketplaceId),
        this.fetchPoliciesFromEbay(accessToken, 'return_policy', marketplaceId),
      ]);
      return [
        ...fulfillment.map((policy) => ({ id: String(policy.fulfillmentPolicyId ?? ''), name: String(policy.name ?? ''), type: 'shipping' as const, description: String(policy.description ?? '') })),
        ...payment.map((policy) => ({ id: String(policy.paymentPolicyId ?? ''), name: String(policy.name ?? ''), type: 'payment' as const, description: String(policy.description ?? '') })),
        ...returns.map((policy) => ({ id: String(policy.returnPolicyId ?? ''), name: String(policy.name ?? ''), type: 'return' as const, description: String(policy.description ?? '') })),
      ];
    } catch (error) {
      this.logger.error(`Failed to fetch business policies from eBay: ${getErrorMessage(error)}`);
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
  <ItemID>${ebayItemId.replace(/[^0-9]/g, '')}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`;

    const baseUrl = this.configService.get<string>('EBAY_XML_API_URL') || '';
    const siteId = this.resolveSiteId(account.marketplace_id);

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
