import { Injectable, Logger } from '@nestjs/common';
import {
  TrackingConversionProvider,
  createDefaultBlacklist,
  type BlacklistKeyword,
  type BuyerMessagingConfig,
  type SaveStoreSettingsRequest,
  type StoreSettingsResponse,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import { inheritMissingStoreLocation } from './store-settings.helpers';

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
  check_blacklist: boolean;
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
        checkBlacklist: true,
        blacklist: createDefaultBlacklist(),
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
    const globalSettings = await this.getSettings(userId);

    if (!storeId) {
      return globalSettings;
    }

    const storeSettings = await this.getSettings(userId, storeId);
    if (!storeSettings.id) {
      return globalSettings;
    }

    // Focused drawers can create a store row before its location is configured.
    // Inherit ONLY the empty location fields — the store still owns every other
    // override (A2, tax, blacklist, validation and buyer messaging).
    return inheritMissingStoreLocation(storeSettings, globalSettings);
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
      checkBlacklist,
      blacklist,
      amazonTaxRate,
      autoFulfillEnabled,
      trackingConversionProvider,
      buyerMessaging,
    } = dto;

    // A focused drawer omits fields it does not own. Empty location strings are
    // also omission: `getSettings` synthesizes '' when a row does not exist and
    // older callers echo that DTO back. INSERT still satisfies the NOT NULL
    // schema through COALESCE defaults below.
    const countryValue = country?.trim() ? country.trim() : null;
    const stateValue = state?.trim() ? state.trim() : null;
    const zipCodeValue = zipCode?.trim() ? zipCode.trim() : null;
    const blacklistJson = blacklist ? JSON.stringify(blacklist) : null;
    // Optional means "leave unchanged" on UPDATE, not "turn off". Multiple
    // focused drawers save through this endpoint (e.g. Blacklist omits general
    // settings), so defaulting an omitted field silently undid a toggle saved
    // moments earlier. INSERT still resolves null to the schema default.
    const checkBlacklistBool = checkBlacklist ?? null;
    const autoFulfillBool = autoFulfillEnabled ?? null;
    const trackingProviderValue = trackingConversionProvider ?? null;
    // Preserve the distinction between omitted (leave unchanged on UPDATE) and
    // explicit null (turn buyer messaging off). `undefined` is represented by a
    // separate boolean parameter because node-postgres serializes both as NULL.
    const buyerMessagingProvided = buyerMessaging !== undefined;
    const buyerMessagingJson = buyerMessaging ? JSON.stringify(buyerMessaging) : null;

    let result: StoreSettingsEntity[];

    if (isGlobal) {
      // Upsert global settings for THIS user
      result = await this.databaseService.query<StoreSettingsEntity>(
        `
            INSERT INTO store_settings (user_id, is_global, country, state, zip_code, check_blacklist, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, buyer_messaging)
            VALUES ($1, TRUE, COALESCE($2, ''), COALESCE($3, ''), COALESCE($4, ''), COALESCE($5, TRUE), COALESCE($6::jsonb, '[{"keyword":"Amazon","types":["title","description","feature_specification","brand_manufacturer"]}]'::jsonb), $7, COALESCE($8, FALSE), COALESCE($9, 'local'), $10)
            ON CONFLICT (user_id, is_global) WHERE is_global = TRUE
            DO UPDATE SET
                country = COALESCE($2, store_settings.country),
                state = COALESCE($3, store_settings.state),
                zip_code = COALESCE($4, store_settings.zip_code),
                check_blacklist = COALESCE($5, store_settings.check_blacklist),
                blacklist = COALESCE($6::jsonb, store_settings.blacklist),
                amazon_tax_rate = EXCLUDED.amazon_tax_rate,
                auto_fulfill_enabled = COALESCE($8, store_settings.auto_fulfill_enabled),
                tracking_conversion_provider = COALESCE($9, store_settings.tracking_conversion_provider),
                buyer_messaging = CASE
                  WHEN $11 THEN EXCLUDED.buyer_messaging
                  ELSE store_settings.buyer_messaging
                END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `,
        [
          userId,
          countryValue,
          stateValue,
          zipCodeValue,
          checkBlacklistBool,
          blacklistJson,
          amazonTaxRate,
          autoFulfillBool,
          trackingProviderValue,
          buyerMessagingJson,
          buyerMessagingProvided,
        ]
      );
    } else {
      // Upsert store-specific settings for THIS user
      result = await this.databaseService.query<StoreSettingsEntity>(
        `
            INSERT INTO store_settings (user_id, store_id, is_global, country, state, zip_code, check_blacklist, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, buyer_messaging)
            VALUES ($1, $2, FALSE, COALESCE($3, ''), COALESCE($4, ''), COALESCE($5, ''), COALESCE($6, TRUE), COALESCE($7::jsonb, '[{"keyword":"Amazon","types":["title","description","feature_specification","brand_manufacturer"]}]'::jsonb), $8, COALESCE($9, FALSE), COALESCE($10, 'local'), $11)
            ON CONFLICT (user_id, store_id) WHERE store_id IS NOT NULL
            DO UPDATE SET
                country = COALESCE($3, store_settings.country),
                state = COALESCE($4, store_settings.state),
                zip_code = COALESCE($5, store_settings.zip_code),
                check_blacklist = COALESCE($6, store_settings.check_blacklist),
                blacklist = COALESCE($7::jsonb, store_settings.blacklist),
                amazon_tax_rate = EXCLUDED.amazon_tax_rate,
                auto_fulfill_enabled = COALESCE($9, store_settings.auto_fulfill_enabled),
                tracking_conversion_provider = COALESCE($10, store_settings.tracking_conversion_provider),
                buyer_messaging = CASE
                  WHEN $12 THEN EXCLUDED.buyer_messaging
                  ELSE store_settings.buyer_messaging
                END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `,
        [
          userId,
          storeId,
          countryValue,
          stateValue,
          zipCodeValue,
          checkBlacklistBool,
          blacklistJson,
          amazonTaxRate,
          autoFulfillBool,
          trackingProviderValue,
          buyerMessagingJson,
          buyerMessagingProvided,
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
      checkBlacklist: entity.check_blacklist,
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
