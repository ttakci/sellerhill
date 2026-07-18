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
    // auto-purchased on Amazon. Read path here; upsert + proxy/cap guardrails
    // land with the settings-backend task.
    autoFulfillEnabled: boolean;

    createdAt: Date;
    updatedAt: Date;
}
