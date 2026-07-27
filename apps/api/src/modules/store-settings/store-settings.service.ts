import { Injectable, Logger } from '@nestjs/common';
import {
  TrackingConversionProvider,
  type BlacklistKeyword,
  type BuyerMessagingConfig,
  type SaveStoreSettingsRequest,
  type StoreSettingsResponse,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

/**
 * Store Settings Entity
 */
interface StoreSettingsEntity {
  id: string;
  user_id: string;
  store_id: string | null;
  is_global: boolean;
  country: string;
  state: string;
  zip_code: string;
  validate_title: boolean;
  validate_description: boolean;
  blacklist: string; // JSON string in DB
  amazon_tax_rate: string | number; // NUMERIC(5,2) — coerced via Number() in mapper
  // A2 auto-fulfillment master toggle (migration 036).
  auto_fulfill_enabled: boolean;
  // Carrier-mapping provider; persisted LOWERCASE — the tracking processor
  // compares the raw DB string case-sensitively (migration 036, default 'local').
  tracking_conversion_provider: string;
  // Buyer auto-messaging config JSONB (migration 054). Nullable — NULL means
  // the feature is off (no automated buyer messages). Parsed in mapToDto.
  buyer_messaging: unknown;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class StoreSettingsService {
  private readonly logger = new Logger(StoreSettingsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * List ALL settings rows for a user (global + per-store).
   * Used by the Settings hub to render each configuration as a card.
   */
  async listSettings(userId: string): Promise<StoreSettingsResponse[]> {
    const results = await this.databaseService.query<StoreSettingsEntity>(
      `SELECT * FROM store_settings WHERE user_id = $1 ORDER BY is_global DESC, updated_at DESC`,
      [userId],
    );
    return results.map((row) => this.mapToDto(row));
  }

  /**
   * Get settings for a specific store or global
   */
  async getSettings(userId: string, storeId?: string): Promise<StoreSettingsResponse> {
    const query = storeId
      ? `SELECT * FROM store_settings WHERE user_id = $1 AND store_id = $2`
      : `SELECT * FROM store_settings WHERE user_id = $1 AND is_global = TRUE`;

    const params = storeId ? [userId, storeId] : [userId];

    const results = await this.databaseService.query<StoreSettingsEntity>(query, params);

    if (results.length === 0) {
      // Return default settings if none found
      return {
        id: '',
        isGlobal: !storeId,
        storeId,
        country: '',
        state: '',
        zipCode: '',
        validateTitle: true,
        validateDescription: false,
        blacklist: [],
        amazonTaxRate: 0,
        autoFulfillEnabled: false,
        trackingConversionProvider: TrackingConversionProvider.LOCAL,
        buyerMessaging: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    return this.mapToDto(results[0]);
  }

  /**
   * Get resolved settings (Store specific > Global > Default)
   */
  async getResolvedSettings(userId: string, storeId: string | null): Promise<StoreSettingsResponse> {
    // 1. Try Store Specific (if storeId provided)
    if (storeId) {
      const storeSettings = await this.getSettings(userId, storeId);
      if (storeSettings.id) {
        // Found valid settings
        return storeSettings;
      }
    }

    // 2. Fallback to Global
    return this.getSettings(userId);
  }

  /**
   * Save settings
   */
  async saveSettings(userId: string, dto: SaveStoreSettingsRequest): Promise<StoreSettingsResponse> {
    const {
      isGlobal,
      storeId,
      country,
      state,
      zipCode,
      validateTitle,
      validateDescription,
      blacklist,
      amazonTaxRate,
      autoFulfillEnabled,
      // Default to LOCAL when omitted so existing callers that don't send the
      // field don't blow away a prior value with NULL. Persisted LOWERCASE — the
      // tracking processor compares the raw DB string case-sensitively.
      trackingConversionProvider = TrackingConversionProvider.LOCAL,
      buyerMessaging,
    } = dto;

    const blacklistJson = JSON.stringify(blacklist);
    const autoFulfillBool = autoFulfillEnabled ?? false;
    // null-safe JSON for the JSONB cell: null means "feature off".
    const buyerMessagingJson = buyerMessaging ? JSON.stringify(buyerMessaging) : null;

    let result: StoreSettingsEntity[];

    if (isGlobal) {
      // Upsert global settings for THIS user
      result = await this.databaseService.query<StoreSettingsEntity>(
        `
            INSERT INTO store_settings (user_id, is_global, country, state, zip_code, validate_title, validate_description, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, buyer_messaging)
            VALUES ($1, TRUE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (user_id, is_global) WHERE is_global = TRUE
            DO UPDATE SET
                country = EXCLUDED.country,
                state = EXCLUDED.state,
                zip_code = EXCLUDED.zip_code,
                validate_title = EXCLUDED.validate_title,
                validate_description = EXCLUDED.validate_description,
                blacklist = EXCLUDED.blacklist,
                amazon_tax_rate = EXCLUDED.amazon_tax_rate,
                auto_fulfill_enabled = EXCLUDED.auto_fulfill_enabled,
                tracking_conversion_provider = EXCLUDED.tracking_conversion_provider,
                buyer_messaging = EXCLUDED.buyer_messaging,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `,
        [
          userId,
          country,
          state,
          zipCode,
          validateTitle,
          validateDescription,
          blacklistJson,
          amazonTaxRate,
          autoFulfillBool,
          trackingConversionProvider,
          buyerMessagingJson,
        ]
      );
    } else {
      // Upsert store-specific settings for THIS user
      result = await this.databaseService.query<StoreSettingsEntity>(
        `
            INSERT INTO store_settings (user_id, store_id, is_global, country, state, zip_code, validate_title, validate_description, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, buyer_messaging)
            VALUES ($1, $2, FALSE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (user_id, store_id) WHERE store_id IS NOT NULL
            DO UPDATE SET
                country = EXCLUDED.country,
                state = EXCLUDED.state,
                zip_code = EXCLUDED.zip_code,
                validate_title = EXCLUDED.validate_title,
                validate_description = EXCLUDED.validate_description,
                blacklist = EXCLUDED.blacklist,
                amazon_tax_rate = EXCLUDED.amazon_tax_rate,
                auto_fulfill_enabled = EXCLUDED.auto_fulfill_enabled,
                tracking_conversion_provider = EXCLUDED.tracking_conversion_provider,
                buyer_messaging = EXCLUDED.buyer_messaging,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `,
        [
          userId,
          storeId,
          country,
          state,
          zipCode,
          validateTitle,
          validateDescription,
          blacklistJson,
          amazonTaxRate,
          autoFulfillBool,
          trackingConversionProvider,
          buyerMessagingJson,
        ]
      );
    }

    return this.mapToDto(result[0]);
  }

  /**
   * Map database entity to DTO
   */
  private mapToDto(entity: StoreSettingsEntity): StoreSettingsResponse {
    const parsedBlacklist =
      typeof entity.blacklist === 'string'
        ? (JSON.parse(entity.blacklist) as BlacklistKeyword[])
        : (entity.blacklist as unknown as BlacklistKeyword[]);

    return {
      id: entity.id,
      storeId: entity.store_id || undefined,
      isGlobal: entity.is_global,
      country: entity.country,
      state: entity.state,
      zipCode: entity.zip_code,
      validateTitle: entity.validate_title,
      validateDescription: entity.validate_description,
      blacklist: parsedBlacklist,
      amazonTaxRate: Number(entity.amazon_tax_rate) || 0,
      autoFulfillEnabled: !!entity.auto_fulfill_enabled,
      // Normalize: tolerate any stray uppercase from older rows; persist LOWERCASE.
      // Compare to the string literal `'api'` (not the enum) to avoid
      // `no-unsafe-enum-comparison` between the DB-side string and the enum,
      // mirroring the tracking processor's case-sensitive check.
      trackingConversionProvider:
        entity.tracking_conversion_provider === 'api'
          ? TrackingConversionProvider.API
          : TrackingConversionProvider.LOCAL,
      buyerMessaging: this.parseBuyerMessaging(entity.buyer_messaging),
      createdAt: entity.created_at,
      updatedAt: entity.updated_at,
    };
  }

  /**
   * Parse the buyer_messaging JSONB cell into a typed config object.
   * Returns null when the cell is NULL, missing, or not a JSON object —
   * null means the feature is OFF (no automated buyer messages).
   */
  private parseBuyerMessaging(raw: unknown): BuyerMessagingConfig | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    try {
      return raw as BuyerMessagingConfig;
    } catch {
      return null;
    }
  }
}
