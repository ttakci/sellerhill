import type {
  AmazonAccountPublicDto,
  EbayAccountPublicDto,
  ListingSettingsGroupResponse,
  ProfileDto,
  StoreSettingsResponse,
} from '@repo/shared';

export type SettingsDrawerKey =
  | 'profile'
  | 'ebay'
  | 'amazonAdd'
  | 'amazonList'
  | 'storeSettings'
  | 'blacklistAdd'
  | 'blacklistList'
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
  availableStores: Array<{ id: string; name: string }>;
}
