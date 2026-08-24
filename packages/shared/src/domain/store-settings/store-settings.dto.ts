import { TrackingConversionProvider, TrackingConversionScope } from '../amazon';
import type { BuyerMessagingConfig } from '../buyer-messaging/buyer-messaging.types';

import { BlacklistKeyword, StoreSettings } from './store-settings.types';

/**
 * Request DTO for creating/updating Store Settings
 *
 * Several FOCUSED drawers write disjoint halves of one row: `StoreSettingsDrawer`
 * owns location/validation/tax/A2, `BlacklistDrawer` owns the blacklist. So an
 * OMITTED optional field means "leave unchanged" on UPDATE (and falls back to
 * the column default on INSERT) — never "erase". An empty string is treated the
 * same as omitted for the location fields, because `getSettings` synthesizes
 * `''` defaults when a row does not exist yet and callers echo those back.
 */
export interface SaveStoreSettingsRequest {
    isGlobal: boolean;
    storeId?: string;

    // Owned by StoreSettingsDrawer. Omitted by the blacklist drawer.
    country?: string;
    state?: string;
    zipCode?: string;

    // Owned by StoreSettingsDrawer. Optional — omitted means "leave unchanged"
    // (see class doc above), same pattern as autoFulfillEnabled.
    checkBlacklist?: boolean;

    // Ship-from / return address for Aquiline profiles. Owned by
    // StoreSettingsDrawer. Optional — omitted means "leave unchanged" (same
    // pattern as country/state/zipCode), and every field stays optional end
    // to end since a seller on the local provider never needs them.
    shipFromName?: string;
    shipFromPhone?: string;
    shipFromAddressLine1?: string;
    shipFromAddressLine2?: string;
    shipFromCity?: string;

    // Owned by BlacklistDrawer. Omitted by the store-settings drawer.
    blacklist?: Omit<BlacklistKeyword, 'id'>[];

    // Percent 0–100 used to estimate provisional order profit when real tax unknown.
    amazonTaxRate: number;

    // A2 master toggle (per-user global). When off, no eBay order is auto-purchased.
    // Optional on the request — service defaults to false. Response always carries it.
    autoFulfillEnabled?: boolean;

    // Carrier-mapping provider; persisted LOWERCASE ('local' | 'api').
    // Optional on the request — service defaults to LOCAL. Response always carries it.
    trackingConversionProvider?: TrackingConversionProvider;

    // Which carriers the provider above applies to.
    // Optional on the request — service defaults to AMAZON_LOGISTICS_ONLY.
    trackingConversionScope?: TrackingConversionScope;

    // Whether manually linked orders are converted automatically too.
    // Optional on the request — service defaults to true.
    trackingConvertManualOrders?: boolean;

    // Buyer auto-messaging config (per-user global store setting).
    // Optional on the request — service defaults to disabled. Response always carries it.
    buyerMessaging?: BuyerMessagingConfig | null;
}

/**
 * Response DTO for Store Settings
 */
export interface StoreSettingsResponse extends StoreSettings {}
