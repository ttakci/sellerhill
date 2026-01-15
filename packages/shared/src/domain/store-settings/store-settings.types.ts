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
    
    createdAt: Date;
    updatedAt: Date;
}
