import { Injectable, Logger } from '@nestjs/common';
import {
  TrackingConversionProvider,
  TrackingConversionScope,
  createDefaultBlacklist,
  normalizeListingRules,
  type BlacklistKeyword,
  type BuyerMessagingConfig,
  type SaveStoreSettingsRequest,
  type StoreSettingsResponse,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import {
  inheritMissingStoreLocation,
  mapTrackingConversionProvider,
  resolveAllowCrossStoreAsins,
} from './store-settings.helpers';

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
  // Loss limit per automatic order (migration 132). NUMERIC(10,2); NULL = off.
  auto_fulfill_max_loss: string | number | null;
  // Carrier-mapping provider; persisted LOWERCASE — the tracking processor
  // compares the raw DB string case-sensitively (migration 036, default 'local').
  tracking_conversion_provider: string;
  // Which carriers the provider above is applied to (migration 086).
  // 'all' | 'amazon_logistics_only'.
  tracking_conversion_scope: string;
  // Convert tracking for orders the seller linked by hand too (migration 086).
  tracking_convert_manual_orders: boolean;
  // Buyer auto-messaging config JSONB (migration 054). Nullable — NULL means
  // the feature is off (no automated buyer messages). Parsed in mapToDto.
  buyer_messaging: unknown;
  // Ship-from / return address for Aquiline profiles (migration 089). All
  // nullable — a seller on the local pass-through provider never sets them.
  ship_from_name: string | null;
  ship_from_phone: string | null;
  ship_from_address_line1: string | null;
  ship_from_address_line2: string | null;
  ship_from_city: string | null;
  // The seller's listing rules (migration 138). NULL = never saved.
  listing_rules: unknown;
  // ASINs already on the seller's other stores may be listed here (migration
  // 140). NULL = inherit: a store row follows the global row, global NULL = off.
  allow_cross_store_asins: boolean | null;
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
        autoFulfillMaxLoss: null,
        // Conversion is ON by default (migration 112). A seller with no row has
        // not chosen the raw Amazon number — they have chosen nothing.
        trackingConversionProvider: TrackingConversionProvider.AQUILINE,
        trackingConversionScope: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
        trackingConvertManualOrders: true,
        buyerMessaging: null,
        allowCrossStoreAsins: null,
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

    // The resolved settings always carry a BOOLEAN `allowCrossStoreAsins`:
    // the store's own value, else the global one, else off.
    const withRules = (settings: StoreSettingsResponse): StoreSettingsResponse => ({
      ...settings,
      listingRules: normalizeListingRules(settings.listingRules ?? globalSettings.listingRules),
      allowCrossStoreAsins: resolveAllowCrossStoreAsins(
        settings.allowCrossStoreAsins,
        globalSettings.allowCrossStoreAsins,
      ),
    });

    if (!storeId) {
      return withRules(globalSettings);
    }

    const storeSettings = await this.getSettings(userId, storeId);
    if (!storeSettings.id) {
      return withRules(globalSettings);
    }

    // Focused drawers can create a store row before its location is configured.
    // Inherit ONLY the empty location fields — the store still owns every other
    // override (A2, tax, blacklist, validation). Listing rules and buyer
    // messaging follow the loss limit's rule instead: a store row that never
    // saved any inherits the global ones, so a choice made for every store is
    // not silently dropped by a row another drawer created (a NULL messaging
    // config there used to switch messaging OFF for that store).
    const resolved = inheritMissingStoreLocation(storeSettings, globalSettings);
    return withRules({
      ...resolved,
      buyerMessaging: resolved.buyerMessaging ?? globalSettings.buyerMessaging,
    });
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
      autoFulfillMaxLoss,
      trackingConversionProvider,
      trackingConversionScope,
      trackingConvertManualOrders,
      buyerMessaging,
      shipFromName,
      shipFromPhone,
      shipFromAddressLine1,
      shipFromAddressLine2,
      shipFromCity,
      listingRules,
      allowCrossStoreAsins,
    } = dto;

    // A focused drawer omits fields it does not own. Empty location strings are
    // also omission: `getSettings` synthesizes '' when a row does not exist and
    // older callers echo that DTO back. On INSERT an omitted field takes the
    // GLOBAL row's value (a store's first row is a copy of "all stores"), then
    // the schema default. It used to take the column default directly, so a
    // blacklist save on a store with no row wrote auto-fulfill OFF and the
    // tracking provider 'local' — the raw Amazon number went to eBay.
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
    // Same omitted-means-unchanged rule as every optional field above: the
    // blacklist drawer saves through this endpoint too and must not reset a
    // conversion setting the seller changed in the other drawer.
    const trackingScopeValue = trackingConversionScope ?? null;
    const trackingManualValue = trackingConvertManualOrders ?? null;
    // Preserve the distinction between omitted (leave unchanged on UPDATE) and
    // explicit null (turn buyer messaging off). `undefined` is represented by a
    // separate boolean parameter because node-postgres serializes both as NULL.
    const buyerMessagingProvided = buyerMessaging !== undefined;
    const buyerMessagingJson = buyerMessaging ? JSON.stringify(buyerMessaging) : null;
    // The loss limit has the same three states: omitted (a focused drawer that
    // does not own it — leave unchanged), explicit null (the seller turned the
    // limit off) and a number. COALESCE cannot express "set to NULL", hence the
    // separate provided flag.
    const maxLossProvided = autoFulfillMaxLoss !== undefined;
    const maxLossValue =
      typeof autoFulfillMaxLoss === 'number' && Number.isFinite(autoFulfillMaxLoss) && autoFulfillMaxLoss >= 0
        ? Math.round(autoFulfillMaxLoss * 100) / 100
        : null;

    // Ship-from / return address for Aquiline profiles. Same "omitted or
    // blank means leave unchanged" rule as country/state/zipCode above — the
    // columns are nullable, so a trimmed-empty value is just passed through
    // as NULL and COALESCE on the UPDATE branch preserves whatever is
    // already stored.
    const shipFromNameValue = shipFromName?.trim() ? shipFromName.trim() : null;
    const shipFromPhoneValue = shipFromPhone?.trim() ? shipFromPhone.trim() : null;
    const shipFromAddressLine1Value = shipFromAddressLine1?.trim() ? shipFromAddressLine1.trim() : null;
    const shipFromAddressLine2Value = shipFromAddressLine2?.trim() ? shipFromAddressLine2.trim() : null;
    const shipFromCityValue = shipFromCity?.trim() ? shipFromCity.trim() : null;

    // Omitted = leave unchanged (every other drawer omits it); an object
    // replaces the stored rules whole, normalized so nothing malformed or out
    // of bounds is ever stored.
    const listingRulesProvided = listingRules !== undefined;
    const listingRulesJson = listingRulesProvided ? JSON.stringify(normalizeListingRules(listingRules)) : null;

    // Three states again: omitted = unchanged, null = inherit (store follows
    // global; global null = off), boolean = this row's own choice. A NEW store
    // row is NOT seeded from global here — its NULL already means "follow the
    // global row", and copying the value would freeze it.
    const allowCrossStoreProvided = allowCrossStoreAsins !== undefined;
    const allowCrossStoreValue = typeof allowCrossStoreAsins === 'boolean' ? allowCrossStoreAsins : null;

    let result: StoreSettingsEntity[];

    if (isGlobal) {
      // Upsert global settings for THIS user
      result = await this.databaseService.query<StoreSettingsEntity>(
        `
            INSERT INTO store_settings (user_id, is_global, country, state, zip_code, check_blacklist, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, tracking_conversion_scope, tracking_convert_manual_orders, buyer_messaging, ship_from_name, ship_from_phone, ship_from_address_line1, ship_from_address_line2, ship_from_city, auto_fulfill_max_loss, listing_rules, allow_cross_store_asins)
            VALUES ($1, TRUE, COALESCE($2, ''), COALESCE($3, ''), COALESCE($4, ''), COALESCE($5, TRUE), COALESCE($6::jsonb, '[{"keyword":"Amazon","types":["title","description","feature_specification","brand_manufacturer"]}]'::jsonb), COALESCE($7::numeric, 0), COALESCE($8, FALSE), COALESCE($9, 'aquiline'), COALESCE($12, 'amazon_logistics_only'), COALESCE($13, TRUE), $10, $14, $15, $16, $17, $18, $19::numeric, $21::jsonb, $23::boolean)
            ON CONFLICT (user_id, is_global) WHERE is_global = TRUE
            DO UPDATE SET
                country = COALESCE($2, store_settings.country),
                state = COALESCE($3, store_settings.state),
                zip_code = COALESCE($4, store_settings.zip_code),
                check_blacklist = COALESCE($5, store_settings.check_blacklist),
                blacklist = COALESCE($6::jsonb, store_settings.blacklist),
                amazon_tax_rate = COALESCE($7::numeric, store_settings.amazon_tax_rate),
                auto_fulfill_enabled = COALESCE($8, store_settings.auto_fulfill_enabled),
                tracking_conversion_provider = COALESCE($9, store_settings.tracking_conversion_provider),
                tracking_conversion_scope = COALESCE($12, store_settings.tracking_conversion_scope),
                tracking_convert_manual_orders = COALESCE($13, store_settings.tracking_convert_manual_orders),
                buyer_messaging = CASE
                  WHEN $11 THEN EXCLUDED.buyer_messaging
                  ELSE store_settings.buyer_messaging
                END,
                ship_from_name = COALESCE($14, store_settings.ship_from_name),
                ship_from_phone = COALESCE($15, store_settings.ship_from_phone),
                ship_from_address_line1 = COALESCE($16, store_settings.ship_from_address_line1),
                ship_from_address_line2 = COALESCE($17, store_settings.ship_from_address_line2),
                ship_from_city = COALESCE($18, store_settings.ship_from_city),
                auto_fulfill_max_loss = CASE
                  WHEN $20::boolean THEN EXCLUDED.auto_fulfill_max_loss
                  ELSE store_settings.auto_fulfill_max_loss
                END,
                listing_rules = CASE
                  WHEN $22::boolean THEN EXCLUDED.listing_rules
                  ELSE store_settings.listing_rules
                END,
                allow_cross_store_asins = CASE
                  WHEN $24::boolean THEN EXCLUDED.allow_cross_store_asins
                  ELSE store_settings.allow_cross_store_asins
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
          trackingScopeValue,
          trackingManualValue,
          shipFromNameValue,
          shipFromPhoneValue,
          shipFromAddressLine1Value,
          shipFromAddressLine2Value,
          shipFromCityValue,
          maxLossValue,
          maxLossProvided,
          listingRulesJson,
          listingRulesProvided,
          allowCrossStoreValue,
          allowCrossStoreProvided,
        ]
      );
    } else {
      // Upsert store-specific settings for THIS user
      result = await this.databaseService.query<StoreSettingsEntity>(
        `
            INSERT INTO store_settings (user_id, store_id, is_global, country, state, zip_code, check_blacklist, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, tracking_conversion_scope, tracking_convert_manual_orders, buyer_messaging, ship_from_name, ship_from_phone, ship_from_address_line1, ship_from_address_line2, ship_from_city, auto_fulfill_max_loss, listing_rules, allow_cross_store_asins)
            SELECT $1, $2, FALSE,
                   COALESCE($3, ''), COALESCE($4, ''), COALESCE($5, ''),
                   COALESCE($6::boolean, g.check_blacklist, TRUE),
                   COALESCE($7::jsonb, g.blacklist, '[{"keyword":"Amazon","types":["title","description","feature_specification","brand_manufacturer"]}]'::jsonb),
                   COALESCE($8::numeric, g.amazon_tax_rate, 0),
                   COALESCE($9::boolean, g.auto_fulfill_enabled, FALSE),
                   COALESCE($10::varchar, g.tracking_conversion_provider, 'aquiline'),
                   COALESCE($13::varchar, g.tracking_conversion_scope, 'amazon_logistics_only'),
                   COALESCE($14::boolean, g.tracking_convert_manual_orders, TRUE),
                   $11::jsonb, $15, $16, $17, $18, $19, $20::numeric, $22::jsonb, $24::boolean
              FROM (SELECT 1) AS seed
              LEFT JOIN store_settings g ON g.user_id = $1 AND g.is_global = TRUE
            ON CONFLICT (user_id, store_id) WHERE store_id IS NOT NULL
            DO UPDATE SET
                country = COALESCE($3, store_settings.country),
                state = COALESCE($4, store_settings.state),
                zip_code = COALESCE($5, store_settings.zip_code),
                check_blacklist = COALESCE($6, store_settings.check_blacklist),
                blacklist = COALESCE($7::jsonb, store_settings.blacklist),
                amazon_tax_rate = COALESCE($8::numeric, store_settings.amazon_tax_rate),
                auto_fulfill_enabled = COALESCE($9, store_settings.auto_fulfill_enabled),
                tracking_conversion_provider = COALESCE($10, store_settings.tracking_conversion_provider),
                tracking_conversion_scope = COALESCE($13, store_settings.tracking_conversion_scope),
                tracking_convert_manual_orders = COALESCE($14, store_settings.tracking_convert_manual_orders),
                buyer_messaging = CASE
                  WHEN $12 THEN EXCLUDED.buyer_messaging
                  ELSE store_settings.buyer_messaging
                END,
                ship_from_name = COALESCE($15, store_settings.ship_from_name),
                ship_from_phone = COALESCE($16, store_settings.ship_from_phone),
                ship_from_address_line1 = COALESCE($17, store_settings.ship_from_address_line1),
                ship_from_address_line2 = COALESCE($18, store_settings.ship_from_address_line2),
                ship_from_city = COALESCE($19, store_settings.ship_from_city),
                auto_fulfill_max_loss = CASE
                  WHEN $21::boolean THEN EXCLUDED.auto_fulfill_max_loss
                  ELSE store_settings.auto_fulfill_max_loss
                END,
                listing_rules = CASE
                  WHEN $23::boolean THEN EXCLUDED.listing_rules
                  ELSE store_settings.listing_rules
                END,
                allow_cross_store_asins = CASE
                  WHEN $25::boolean THEN EXCLUDED.allow_cross_store_asins
                  ELSE store_settings.allow_cross_store_asins
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
          trackingScopeValue,
          trackingManualValue,
          shipFromNameValue,
          shipFromPhoneValue,
          shipFromAddressLine1Value,
          shipFromAddressLine2Value,
          shipFromCityValue,
          maxLossValue,
          maxLossProvided,
          listingRulesJson,
          listingRulesProvided,
          allowCrossStoreValue,
          allowCrossStoreProvided,
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
      // NULL (or anything unparseable) = no limit; 0 is a real limit ("never at a loss").
      autoFulfillMaxLoss:
        entity.auto_fulfill_max_loss !== null &&
        entity.auto_fulfill_max_loss !== undefined &&
        Number.isFinite(Number(entity.auto_fulfill_max_loss))
          ? Number(entity.auto_fulfill_max_loss)
          : null,
      // Normalize: tolerate any stray uppercase from older rows; persist LOWERCASE.
      // Compare to the string literal `'api'` (not the enum) to avoid
      // `no-unsafe-enum-comparison` between the DB-side string and the enum,
      // mirroring the tracking processor's case-sensitive check.
      // Only an explicit 'local' switches conversion off. Conversion is the
      // default (migration 112), so 'api', 'aquiline' and any unreadable value
      // all read as ON — an unknown string must never quietly hand the raw
      // Amazon number to eBay.
      trackingConversionProvider: mapTrackingConversionProvider(entity.tracking_conversion_provider),
      trackingConversionScope:
        entity.tracking_conversion_scope === 'all'
          ? TrackingConversionScope.ALL
          : TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
      // Default TRUE for rows written before migration 086 added the column.
      trackingConvertManualOrders: entity.tracking_convert_manual_orders !== false,
      buyerMessaging: this.parseBuyerMessaging(entity.buyer_messaging),
      shipFromName: entity.ship_from_name || undefined,
      shipFromPhone: entity.ship_from_phone || undefined,
      shipFromAddressLine1: entity.ship_from_address_line1 || undefined,
      shipFromAddressLine2: entity.ship_from_address_line2 || undefined,
      shipFromCity: entity.ship_from_city || undefined,
      // NULL stays absent so the resolver can tell "never saved" (inherit the
      // global row) from "saved with everything off".
      listingRules:
        entity.listing_rules && typeof entity.listing_rules === 'object'
          ? normalizeListingRules(entity.listing_rules)
          : undefined,
      allowCrossStoreAsins:
        typeof entity.allow_cross_store_asins === 'boolean' ? entity.allow_cross_store_asins : null,
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
