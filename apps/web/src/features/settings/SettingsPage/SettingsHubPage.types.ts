import type {
  AmazonAccountPublicDto,
  EbayAccountPublicDto,
  ListingSettingsGroupResponse,
  ProfileDto,
} from '@repo/shared';

export type SettingsDrawerKey =
  | 'profile'
  | 'ebay'
  | 'amazonAdd'
  | 'storeConfig'
  | 'listingGroupNew'
  | 'listingGroupEdit'
  | 'password'
  | 'twoFactor'
  | 'apiAccess'
  | 'language'
  | 'notifications'
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
}

export interface SettingsHubPageComponentProps {
  profile: ProfileDto | null;
  ebayAccounts: EbayAccountPublicDto[];
  amazonAccounts: AmazonAccountDto[];
  listingGroups: ListingSettingsGroupDto[];
  activeDrawer: SettingsDrawerKey;
  onOpenDrawer: (drawer: SettingsDrawerKey) => void;
  onCloseDrawer: () => void;
  editingListingGroupId: string | null;
  onEditListingGroup: (id: string) => void;
  onNavigateToEbayConnect: () => void;
  isImpersonatingAdmin: boolean;
}
