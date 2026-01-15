import { StoreSettingsFormData, StoreSettingsResponse } from '@repo/shared';

export interface StoreSettingsPageProps {
  settings: StoreSettingsResponse;
  onSave: (data: StoreSettingsFormData) => void;
  onStoreChange: (storeId: string) => void;
  availableStores: Array<{ id: string; name: string }>;
}
