import type { TrackingConversionProvider, TrackingConversionScope } from '../amazon';
import type { BuyerMessagingConfig } from '../buyer-messaging/buyer-messaging.types';

/**
 * Steps of the store-settings drawer wizard. The BLACKLIST step here only
 * hosts the `checkBlacklist` master switch — keyword management itself is a
 * separate drawer (`BlacklistDrawer`).
 */
export enum StoreSettingsDrawerStep {
    /** Scope + the four location fields. Nothing else — the address is what
     *  eBay refuses a listing without, so it gets a step of its own. */
    ADDRESS = 0,
    /** Auto-fulfill, the Amazon tax estimate and tracking conversion. */
    AUTOMATION = 1,
    BUYER_MESSAGING = 2,
    BLACKLIST = 3,
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

    // Location Settings — ONE address, serving both the eBay inventory
    // location (published as the listing's item location) and the tracking
    // provider's seller profile. Together with `shipFromCity` below these are
    // the four fields the drawer collects, and `isStoreAddressComplete`
    // requires all four: eBay refuses a STORE location without the full set
    // and the tracking provider refuses a profile without street/city/country.
    // No street is collected — see `buildStoreStreetLine` for why one is
    // derived instead.
    country: string;
    state: string;
    zipCode: string;

    // The location city. Persists to `store_settings.ship_from_city`
    // (migration 089), which was minted for a SEPARATE tracking-provider
    // "ship-from" address that no longer exists as its own form — sellers read
    // two address blocks in one drawer as being asked for the same thing
    // twice, when it was always one address split across two groups. The
    // column is reused rather than replaced because a new column would be a
    // migration for a rename, and the existing values are already cities.
    //
    // OPTIONAL on the wire only for backwards compatibility with rows saved
    // before this became required; treat a missing value as an incomplete
    // address, not as a valid empty one.
    shipFromCity?: string;

    // Dormant since the ship-from form was merged into the address above.
    // Never written by any UI and read by nothing; kept on the type (and in
    // the schema) because existing rows still carry values and the repo does
    // not drop applied-migration columns. Do not reintroduce inputs for these
    // without re-reading why the two-address drawer was merged.
    shipFromName?: string;
    shipFromPhone?: string;
    shipFromAddressLine1?: string;
    shipFromAddressLine2?: string;

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

    // WHICH carriers the provider above is applied to. Default
    // 'amazon_logistics_only' — convert the TB* numbers that unmistakably say
    // "Amazon" and leave real carriers native, which spends less conversion
    // quota and keeps the stronger delivery evidence in an eBay INR case.
    // See TrackingConversionScope for the full trade-off.
    trackingConversionScope: TrackingConversionScope;

    // Whether an order the seller linked by hand is also converted
    // automatically. Default true: a seller who places every order manually
    // would otherwise have to remember a button on each one, and forgetting it
    // exposes the supplier — the exact thing conversion exists to prevent.
    // Bulk historical linking is exempt regardless of this flag, so linking a
    // backlog cannot burn a month of quota at once.
    trackingConvertManualOrders: boolean;

    // Buyer auto-messaging config (per-user global store setting,
    // `store_settings.buyer_messaging` JSONB). Nullable — null/undefined means
    // the feature is off (no automated buyer messages). See BuyerMessagingConfig.
    buyerMessaging?: BuyerMessagingConfig | null;

    createdAt: Date;
    updatedAt: Date;
}
