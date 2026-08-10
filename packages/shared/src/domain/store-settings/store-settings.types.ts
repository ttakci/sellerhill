import type { TrackingConversionProvider } from '../amazon';
import type { BuyerMessagingConfig } from '../buyer-messaging/buyer-messaging.types';

/**
 * Steps of the store-settings drawer wizard. The BLACKLIST step here only
 * hosts the `checkBlacklist` master switch — keyword management itself is a
 * separate drawer (`BlacklistDrawer`).
 */
export enum StoreSettingsDrawerStep {
    GENERAL = 0,
    BUYER_MESSAGING = 1,
    BLACKLIST = 2,
}

/**
 * Blacklist Keyword Interface
 */
export enum BlacklistType {
    TITLE = 'title',
    DESCRIPTION = 'description',
    FEATURE_SPECIFICATION = 'feature_specification',
    BRAND_MANUFACTURER = 'brand_manufacturer',
}

export const DEFAULT_BLACKLIST_KEYWORDS: ReadonlyArray<Readonly<Omit<BlacklistKeyword, 'id'>>> = [
    {
        keyword: 'Amazon',
        types: [
            BlacklistType.TITLE,
            BlacklistType.DESCRIPTION,
            BlacklistType.FEATURE_SPECIFICATION,
            BlacklistType.BRAND_MANUFACTURER,
        ],
    },
];

export function createDefaultBlacklist(): BlacklistKeyword[] {
    return DEFAULT_BLACKLIST_KEYWORDS.map((item, index) => ({
        id: `default-${index}`,
        keyword: item.keyword,
        types: [...item.types],
    }));
}

export interface BlacklistKeyword {
    id: string;
    keyword: string;
    types: BlacklistType[];
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

    // Master toggle for blacklist scanning at listing create. Each keyword's
    // own `types` already scopes WHERE it is checked (title/description/
    // features/brand), so this is the only validation switch left — on/off,
    // not per-field.
    checkBlacklist: boolean;

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
