import { BlacklistKeyword, StoreSettings } from './store-settings.types';

/**
 * Request DTO for creating/updating Store Settings
 */
export interface SaveStoreSettingsRequest {
    isGlobal: boolean;
    storeId?: string;
    
    country: string;
    state: string;
    zipCode: string;
    
    validateTitle: boolean;
    validateDescription: boolean;
    
    blacklist: Omit<BlacklistKeyword, 'id'>[];
}

/**
 * Response DTO for Store Settings
 */
export interface StoreSettingsResponse extends StoreSettings {}
