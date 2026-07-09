import type {
  AmazonAccountPublicDto,
  EbayAccountPublicDto,
  ListingSettingsGroupResponse,
  ProfileDto,
  StoreSettingsResponse,
} from '@repo/shared';

import type { StoreConfigStoreOption } from '../drawers/StoreConfigDrawer';

export type SettingsDrawerKey =
  | 'profile'
  | 'ebay'
  | 'amazonAdd'
  | 'amazonList'
  | 'storeConfig'
  | 'listingGroupNew'
  | 'listingGroupEdit'
  | 'password'
  | 'language'
  | null;

export interface SettingsHubPageComponentProps {
  profile: ProfileDto | null;
  ebayAccounts: EbayAccountPublicDto[];
  amazonAccounts: AmazonAccountPublicDto[];
  listingGroups: ListingSettingsGroupResponse[];
  activeDrawer: SettingsDrawerKey;
  onOpenDrawer: (drawer: SettingsDrawerKey) => void;
  onCloseDrawer: () => void;
  editingListingGroupId: string | null;
  onEditListingGroup: (id: string) => void;
  onNavigateToEbayConnect: () => void;
  isImpersonatingAdmin: boolean;
  isDeactivateModalOpen: boolean;
  onOpenDeactivateModal: () => void;
  onCloseDeactivateModal: () => void;
  // Store configuration
  storeConfigs: StoreSettingsResponse[];
  availableStores: StoreConfigStoreOption[];
  editingStoreConfig: StoreSettingsResponse | null;
  onNewStoreConfig: () => void;
  onEditStoreConfig: (id: string) => void;
}
