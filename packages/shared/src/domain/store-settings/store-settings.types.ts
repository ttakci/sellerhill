import type { TrackingConversionProvider, TrackingConversionScope } from '../amazon';
import type { BuyerMessagingConfig } from '../buyer-messaging/buyer-messaging.types';

import type { ListingRulesConfig } from './listing-rules';

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

/**
 * What a matched keyword does. `BLOCK` (the default, and what every entry
 * saved before this existed means) refuses the listing. `REMOVE` strips the
 * word from the title / description / features it is scoped to and lists the
 * product anyway — for words like "guarantee" that are a problem in the copy,
 * not a reason to skip the product. Matching is whole-word either way.
 */
export enum BlacklistAction {
    BLOCK = 'block',
    REMOVE = 'remove',
}

export interface BlacklistKeyword {
    id: string;
    keyword: string;
    types: BlacklistType[];
    /** Absent = BLOCK. */
    action?: BlacklistAction;
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

    // Loss limit per automatic order (`store_settings.auto_fulfill_max_loss`,
    // migration 132): the most by which the Amazon total at the review step may
    // exceed the eBay payout. Above it the purchase is stopped BEFORE the Place
    // Order click (`loss_limit`). NULL = no limit (the default — some sellers
    // deliberately fulfil at a small loss to protect their account); 0 = never
    // at a loss. Optional on the type because rows read before 132 lack it.
    autoFulfillMaxLoss?: number | null;

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

    // What this seller refuses to list (VeRO protection, blocked ASINs, price
    // range, Amazon-shipped only, rating / review minimums, clean-up rules).
    // Absent on a row that never saved any — read it through
    // `normalizeListingRules`; the RESOLVED settings always carry it, with a
    // store row that has none inheriting the global row's.
    listingRules?: ListingRulesConfig;

    // May this store list an ASIN that is already ACTIVE/DRAFT on ANOTHER of
    // the seller's stores (`store_settings.allow_cross_store_asins`, migration
    // 140)? An ASIN already on the SAME store is always a duplicate. On a raw
    // row: null = not set (a store row inherits the global value, a global
    // null means off). The RESOLVED settings (`getResolvedSettings`) always
    // carry a boolean: store ?? global ?? false.
    allowCrossStoreAsins?: boolean | null;

    createdAt: Date;
    updatedAt: Date;
}
