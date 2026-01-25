import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EBAY_ACCOUNT_STATUS,
  EBAY_MARKETPLACE,
  EBAY_MARKETPLACE_CONFIG,
  type CreateEbayConnectUrlResponse,
  type EbayAccountDto,
  type EbayMarketplaceId,
  type GetEbayAccountsResponse,
} from '@repo/shared';
import axios from 'axios';

import { DatabaseService } from '../../common/database/database.service';
import { EbayOAuthService } from './ebay-oauth.service';

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
  status: 'active' | 'revoked' | 'error';
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class EbayService {
  private readonly logger = new Logger(EbayService.name);

  constructor(
    private readonly oauthService: EbayOAuthService,
    private readonly databaseService: DatabaseService,
    private readonly configService: ConfigService
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
    const { sellerId, storeName } = await this.oauthService.getSellerInfo(tokenResponse.access_token);

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
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        expiresAt,
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
      items: accounts.map((account) => this.mapToDto(account)),
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
    listingData: any, // Enriched data from strategy (including country, currency, etc)
    policies: { paymentId: string; shippingId: string; returnId: string },
    asin: string
  ): Promise<{ listingId: string; categoryName: string }> {
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

    // 4. Generate SKU (e.g. ASIN-NEW)
    const sku = `${asin}-NEW`;

    // 5. Create or Replace Inventory Item (PUT)
    await this.createOrReplaceInventoryItem(accessToken, sku, listingData, config);

    // 6. Ensure Inventory Location Exists
    const merchantLocationKey = 'default';
    await this.ensureInventoryLocation(accessToken, merchantLocationKey, listingData, config);

    // 7. Get Suggested Category (Dynamic)
    const { categoryId, categoryName } = await this.getSuggestedCategory(accessToken, listingData.title, config.siteId);

    // 8. Fetch Required Aspects for this Category
    const requiredAspects = await this.getItemAspectsForCategory(accessToken, categoryId, config.siteId);

    // Self-Healing Loop:
    // If Publish fails due to "Missing Aspect", we catch it, add the missing aspect to 'requiredAspects', and retry.
    // This allows us to auto-fill "Unknown" ONLY when eBay explicitly complains, getting around API data gaps.
    let listingId = '';
    let attempts = 0;
    const maxAttempts = 5; // Increased slightly for safety

    while (attempts < maxAttempts) {
      try {
        // 9. Create or Replace Inventory Item (PUT) with dynamic aspects
        await this.createOrReplaceInventoryItem(accessToken, sku, listingData, config, requiredAspects);

        // 10. Create Offer (POST)
        const offerId = await this.createOffer(
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
        listingId = await this.publishOffer(accessToken, offerId);

        this.logger.log(`Successfully created eBay listing (REST): ${listingId}`);
        return { listingId, categoryName };
      } catch (error: any) {
        attempts++;

        // Check for "Missing Item Specific" error (25002 with specific message pattern)
        // Error format: "The item specific Screen Size is missing."
        // Parameters usually contain the missing key in value or explicitly.
        const errors = error.response?.data?.errors || [];
        const missingAspectError = errors.find((e: any) => e.errorId === 25002 && e.message.includes('item specific'));

        if (missingAspectError && attempts < maxAttempts) {
          // Try to extract the missing aspect name
          // Usually param '2' holds the key name, or we extract from message
          let missingKey = missingAspectError.parameters?.find((p: any) => p.name === '2')?.value; // Verified from logs

          if (!missingKey) {
            // Fallback extraction from message: "The item specific X is missing."
            const msgMatch = missingAspectError.message.match(/item specific (.*?) is missing/);
            if (msgMatch) missingKey = msgMatch[1];
          }

          if (missingKey) {
            this.logger.warn(
              `Publish failed due to missing aspect '${missingKey}'. Auto-filling and retrying... (Attempt ${attempts})`
            );
            if (!requiredAspects.includes(missingKey)) {
              requiredAspects.push(missingKey);
            }
            continue; // Retry loop
          }
        }

        // If not a missing aspect error, or we can't parse it, throw original error
        throw error;
      }
    }

    return { listingId, categoryName };
  }

  /**
   * Create or Replace Inventory Item (REST API)
   */
  private async createOrReplaceInventoryItem(
    accessToken: string,
    sku: string,
    data: any,
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US'],
    requiredAspects: string[] = []
  ): Promise<void> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/inventory_item/${sku}`;

    // Build aspects dynamically
    const aspects: Record<string, string[]> = {
      Brand: [(data.brand || 'Unbranded').substring(0, 65)],
    };

    // Priority 1: Use structured specs if available (from ScraperAPI)
    if (data.specs && typeof data.specs === 'object') {
      Object.entries(data.specs).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length < 65 && !aspects[key]) {
          aspects[key] = [value];
        }
      });
    }

    // Priority 2: Extract "Key: Value" pairs from features (bullet points)
    if (data.features && Array.isArray(data.features)) {
      data.features.forEach((feature: string) => {
        // Regex to find "Key: Value" or "Key - Value" patterns
        const match = feature.match(/(?:^|\.\s+)([A-Za-z0-9\s\-\/\.]{2,30})[:]\s*(.+?)(?=\.|$)/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();

          if (key.length > 2 && value.length < 65 && !aspects[key]) {
            aspects[key] = [value];
          }
        }
      });
    }

    // Fill MISSING required aspects with "Unknown" or safe defaults
    // This solves the validation error generically using the requiredAspects list
    requiredAspects.forEach((req) => {
      if (!aspects[req]) {
        // Check if we have a close match (case insensitive) from our generic extraction
        const existingKey = Object.keys(aspects).find((k) => k.toLowerCase() === req.toLowerCase());
        if (existingKey) {
          aspects[req] = aspects[existingKey];
        } else {
          this.logger.log(`Auto-filling missing required aspect '${req}' for SKU ${sku}`);
          aspects[req] = ['Unknown'];
        }
      }
    });

    const payload = {
      availability: {
        shipToLocationAvailability: {
          quantity: data.quantity || 1,
        },
      },
      condition: 'NEW',
      product: {
        // eBay title limit is 80 characters. Truncate to ensure success.
        title: data.title ? data.title.substring(0, 80) : 'New Product',
        description: data.description ? data.description.substring(0, 4000) : '',
        aspects: aspects,
        // Filter out null/empty URLs and ensure valid format
        // eBay requires at least one image, use placeholder if none available
        // eBay allows maximum 12 images
        imageUrls: (() => {
          const validUrls = (data.imageUrls || []).filter(
            (url: string) => url && typeof url === 'string' && url.startsWith('http')
          );
          if (validUrls.length === 0) {
            this.logger.warn(`No valid images for SKU ${sku}, using placeholder`);
            return ['https://via.placeholder.com/600x600?text=No+Image+Available'];
          }
          // eBay maximum is 12 images
          return validUrls.slice(0, 12);
        })(),
      },
    };

    this.logger.debug(`Creating inventory item ${sku}. URL: ${url}`);

    try {
      await axios.put(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB', // Simplified language logic
        },
      });
    } catch (e: any) {
      this.logger.error(`Create inventory item failed for ${sku}`, e.response?.data || e.message);
      throw e;
    }
  }

  /**
   * Create Offer (REST API)
   */
  private async createOffer(
    accessToken: string,
    sku: string,
    data: any,
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
      listingDescription: data.description ? data.description.substring(0, 4000) : '',
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
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
        },
      });
      return response.data.offerId;
    } catch (e: any) {
      this.logger.error(`Create offer failed for ${sku}`, e.response?.data || e.message);
      if (e.response?.data?.errors) {
        // Handle specific errors like "Location not found"
        this.logger.error('Create offer failed details', JSON.stringify(e.response.data));

        // Handle "Offer entity already exists" (Error 25002)
        const existingOfferError = e.response.data.errors.find((err: any) => err.errorId === 25002);
        if (existingOfferError) {
          const offerIdParam = existingOfferError.parameters?.find((p: any) => p.name === 'offerId');
          if (offerIdParam) {
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
    payload: any,
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
    } catch (e: any) {
      this.logger.warn(`Failed to update existing offer ${offerId}`, e.response?.data || e.message);
      // Non-fatal, return the original ID so we can try to publish
    }
  }

  /**
   * Publish Offer (REST API)
   */
  private async publishOffer(accessToken: string, offerId: string): Promise<string> {
    const url = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offerId}/publish`;

    this.logger.debug(`Publishing offer ${offerId}. URL: ${url}`);

    try {
      const response = await axios.post(
        url,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.listingId;
    } catch (e: any) {
      this.logger.error(`Publish offer failed for ${offerId}`, e.response?.data || e.message);
      throw e;
    }
  }

  /**
   * Ensure Inventory Location exists
   */
  private async ensureInventoryLocation(
    accessToken: string,
    merchantLocationKey: string,
    data: any,
    config: (typeof EBAY_MARKETPLACE_CONFIG)['EBAY_US']
  ): Promise<void> {
    // Try retrieval first to avoid overwriting if exists
    try {
      await axios.get(
        `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/location/${merchantLocationKey}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      return; // Exists
    } catch (e: any) {
      if (e.response?.status !== 404) throw e;
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
    } catch (e: any) {
      this.logger.error(`Create inventory location failed`, e.response?.data || e.message);
      throw e;
    }
  }

  /**
   * Get Suggested Category ID from eBay Taxonomy API
   */
  private async getSuggestedCategory(
    accessToken: string,
    query: string,
    treeId: string
  ): Promise<{ categoryId: string; categoryName: string }> {
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
      if (response.data?.categorySuggestions?.length > 0) {
        const leaf = response.data.categorySuggestions[0].category;
        return {
          categoryId: leaf.categoryId,
          categoryName: leaf.categoryName || 'Unknown Category',
        };
      }

      this.logger.warn(`No category suggestions found for "${query}". Using default (Other).`);
      return { categoryId: '1', categoryName: 'Other' }; // Fallback
    } catch (e) {
      this.logger.error('Failed to get suggested category', e);
      return { categoryId: '1', categoryName: 'Other' }; // Fallback
    }
  }

  /**
   * Get Required Item Aspects for a Category (Taxonomy API)
   */
  private async getItemAspectsForCategory(accessToken: string, categoryId: string, treeId: string): Promise<string[]> {
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

      // Filter for aspects that are mandatory (usage: 'REQUIRED')
      const requiredAspects =
        response.data?.aspects
          ?.filter(
            (a: any) => a.aspectConstraint?.aspectMode === 'REQUIRED' || a.aspectConstraint?.aspectUsage === 'REQUIRED'
          )
          .map((a: any) => a.localizedAspectName) || [];

      return requiredAspects;
    } catch (e) {
      this.logger.warn(`Failed to fetch aspects for category ${categoryId}`, e);
      return [];
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
    listingData?: any // Optional data from strategy
  ): Promise<string> {
    // ... Legacy implementation ...
    this.logger.warn('Use createListingWithRest instead of createListing');
    const result = await this.createListingWithRest(
      userId,
      productId,
      listingData,
      policies,
      listingData.asin || 'UNKNOWN'
    );
    return result.listingId;
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
    if (!account) throw new Error('No active eBay account');

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
    const offersResponse = await axios.get(offersUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const offer = offersResponse.data.offers?.find((o: any) => o.marketplaceId === marketplaceId);
    if (!offer) {
      this.logger.warn(`No offer found for SKU ${sku} on ${marketplaceId}. Cannot update price.`);
    } else {
      const updateOfferUrl = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/offer/${offer.offerId}`;
      const payload = {
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

      await axios.put(updateOfferUrl, payload, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
        },
      });
    }

    // Update Quantity via Inventory Item
    const inventoryUrl = `${this.configService.get('EBAY_REST_API_URL')}/sell/inventory/v1/inventory_item/${sku}`;
    // Fetch existing to get full data (required for PUT)
    const invResponse = await axios.get(inventoryUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const inventoryItem = invResponse.data;
    inventoryItem.availability.shipToLocationAvailability.quantity = quantity;

    await axios.put(inventoryUrl, inventoryItem, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Language': config.countryCode === 'US' ? 'en-US' : 'en-GB',
      },
    });

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
   * Get active eBay account for user
   */
  private async getActiveAccount(userId: string): Promise<EbayAccountEntity | null> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE user_id = $1 AND status = 'active' LIMIT 1`,
      [userId]
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
      return account.access_token;
    }

    this.logger.log(`Access token for account ${account.id} expired. Refreshing...`);
    const tokenResponse = await this.oauthService.refreshAccessToken(account.refresh_token);

    const newExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    await this.databaseService.query(
      `UPDATE ebay_accounts SET access_token = $1, access_token_expires_at = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [tokenResponse.access_token, newExpiresAt, account.id]
    );

    return tokenResponse.access_token;
  }

  /**
   * Build eBay AddItem XML request
   */
  private buildAddItemXml(data: any, policies: { paymentId: string; shippingId: string; returnId: string }): string {
    const { title, description, price, quantity, imageUrls, currency } = data;

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
    <Country>${data.country || 'US'}</Country>
    <Location>${data.country || 'US'}</Location>
    <DispatchTimeMax>3</DispatchTimeMax>
    <ListingDuration>GTC</ListingDuration>
    <ListingType>FixedPriceItem</ListingType>
    <PaymentMethods>PayPal</PaymentMethods>
    <PayPalEmailAddress>test@example.com</PayPalEmailAddress>
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
      if (response.data.includes('<Ack>Success</Ack>') || response.data.includes('<Ack>Warning</Ack>')) {
        const match = response.data.match(/<ItemID>(\d+)<\/ItemID>/);
        return match ? match[1] : `EBAY-MOCK-${Date.now()}`;
      } else {
        const errorMatch = response.data.match(/<LongMessage>(.*?)<\/LongMessage>/);
        throw new Error(errorMatch ? errorMatch[1] : 'Unknown eBay API error');
      }
    } catch (error: any) {
      this.logger.error('eBay API request failed', error.response?.data || error.message);
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
        ...fulfillment.map((p: any) => ({
          id: p.fulfillmentPolicyId,
          name: p.name,
          type: 'shipping',
          description: p.description,
        })),
        ...payment.map((p: any) => ({
          id: p.paymentPolicyId,
          name: p.name,
          type: 'payment',
          description: p.description,
        })),
        ...returns.map((p: any) => ({
          id: p.returnPolicyId,
          name: p.name,
          type: 'return',
          description: p.description,
        })),
      ];

      this.logger.log(`Fetched ${allPolicies.length} business policies from eBay for ${userId}`);
      return allPolicies;
    } catch (error: any) {
      this.logger.error(`Failed to fetch business policies from eBay: ${error.message}`);
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
  <ItemID>${ebayItemId}</ItemID>
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

      if (response.data.includes('<Ack>Success</Ack>') || response.data.includes('<Ack>Warning</Ack>')) {
        this.logger.log(`Successfully ended eBay item: ${ebayItemId}`);
      } else {
        const errorMatch = response.data.match(/<LongMessage>(.*?)<\/LongMessage>/);
        this.logger.error(`Failed to end eBay item ${ebayItemId}: ${errorMatch ? errorMatch[1] : 'Unknown error'}`);
        // If item is already ended, skip error
        if (response.data.includes('291') || response.data.includes('already ended')) {
          this.logger.warn(`Item ${ebayItemId} was already ended.`);
          return;
        }
        throw new Error(errorMatch ? errorMatch[1] : 'Unknown eBay API error');
      }
    } catch (error: any) {
      this.logger.error(`eBay endItem failed for ${ebayItemId}`, error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Helper to fetch policies from specific eBay REST endpoint
   */
  private async fetchPoliciesFromEbay(accessToken: string, policyType: string, marketplaceId: string): Promise<any[]> {
    const baseUrl = this.configService.get<string>('EBAY_REST_API_URL') || '';

    try {
      const response = await axios.get(`${baseUrl}/sell/account/v1/${policyType}?marketplace_id=${marketplaceId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      // The response has a field like 'fulfillmentPolicies', 'paymentPolicies', etc.
      const key = policyType.replace('_', 's').replace('policy', 'Policies');
      const policiesKey = policyType.split('_')[0] + 'Policies';
      return response.data[policiesKey] || [];
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 403) {
        // Business policies might not be enabled on this account
        this.logger.warn(`Business policies (${policyType}) not accessible for account: ${error.message}`);
        return [];
      }
      throw error;
    }
  }

  /**
   * Map entity to DTO
   */
  private mapToDto(entity: EbayAccountEntity): EbayAccountDto {
    return {
      id: entity.id,
      userId: entity.user_id,
      sellerId: entity.seller_id,
      storeName: entity.store_name,
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
