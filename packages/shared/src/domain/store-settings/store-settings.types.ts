import type { TrackingConversionProvider } from '../amazon';
import type { BuyerMessagingConfig } from '../buyer-messaging/buyer-messaging.types';

/**
 * Blacklist Keyword Interface
 */
export interface BlacklistKeyword {
    id: string;
    keyword: string;
    scope: 'title' | 'description' | 'both';
}

/**
 * Store Settings Domain Interface
 */
export interface StoreSettings {
    id: string;
    storeId?: string; // If undefined, applies to all stores
    isGlobal: boolean;

    // Location Settings
    country: string;
    state: string;
    zipCode: string;

    // Validation Settings
    validateTitle: boolean;
    validateDescription: boolean;

    // Blacklist
    blacklist: BlacklistKeyword[];

    // Amazon cost estimation
    // Percent 0–100 used to estimate provisional order profit when real tax unknown.
    amazonTaxRate: number;

    // A2 auto-fulfillment master toggle (per-user global store setting,
    // `store_settings.auto_fulfill_enabled`). When off, no new eBay order is
    // auto-purchased on Amazon.
    autoFulfillEnabled: boolean;

    // Carrier-mapping provider used when an auto-fulfilled order ships and the
    // tracking number must be relayed to eBay. Persisted LOWERCASE ('local' | 'api')
    // — the tracking processor compares case-sensitively. Default 'local'.
    trackingConversionProvider: TrackingConversionProvider;

    // Buyer auto-messaging config (per-user global store setting,
    // `store_settings.buyer_messaging` JSONB). Nullable — null/undefined means
    // the feature is off (no automated buyer messages). See BuyerMessagingConfig.
    buyerMessaging?: BuyerMessagingConfig | null;

    createdAt: Date;
    updatedAt: Date;
}
