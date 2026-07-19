import { TrackingConversionProvider } from '../amazon';

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

    // Percent 0–100 used to estimate provisional order profit when real tax unknown.
    amazonTaxRate: number;

    // A2 master toggle (per-user global). When off, no eBay order is auto-purchased.
    // Optional on the request — service defaults to false. Response always carries it.
    autoFulfillEnabled?: boolean;

    // Carrier-mapping provider; persisted LOWERCASE ('local' | 'api').
    // Optional on the request — service defaults to LOCAL. Response always carries it.
    trackingConversionProvider?: TrackingConversionProvider;
}

/**
 * Response DTO for Store Settings
 */
export interface StoreSettingsResponse extends StoreSettings {}
