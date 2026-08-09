import type {
  AmazonAccountPublicDto,
  BuyerMessageTemplate,
  EbayAccountPublicDto,
  ListingSettingsGroupResponse,
  ProfileDto,
  StoreSettingsResponse,
} from '@repo/shared';

export type SettingsDrawerKey =
  | 'profile'
  | 'ebay'
  | 'amazonAdd'
  | 'amazonEdit'
  | 'amazonList'
  | 'storeSettings'
  | 'storeBlacklist'
  | 'password'
  | 'listingGroupCreate'
  | 'listingGroupEdit'
  | 'listingGroupList'
  | 'buyerMessageTemplateCreate'
  | 'buyerMessageTemplateEdit'
  | 'buyerMessageTemplateList'
  | 'billing'
  | null;

export interface SettingsHubPageComponentProps {
  profile: ProfileDto | null;
  ebayAccounts: EbayAccountPublicDto[];
  amazonAccounts: AmazonAccountPublicDto[];
  listingGroups: ListingSettingsGroupResponse[];
  activeDrawer: SettingsDrawerKey;
  onOpenDrawer: (drawer: SettingsDrawerKey) => void;
  onCloseDrawer: () => void;
  onEditAmazon: (id: string) => void;
  onEditListingGroup: (id: string) => void;
  onViewAllListingGroups: () => void;
  onCreateListingGroup: () => void;
  onConnectEbay: () => void;
  isImpersonatingAdmin: boolean;
  isDeactivateModalOpen: boolean;
  onOpenDeactivateModal: () => void;
  onCloseDeactivateModal: () => void;
  // Store configuration
  storeConfigs: StoreSettingsResponse[];
  availableStores: Array<{ id: string; name: string }>;
  // predefinedTemplateId → display name (for the template badge on each card)
  predefinedTemplateNames: Record<string, string>;
  // Editing group id (for listing group drawer edit mode)
  editingGroupId?: string | null;
  // Editing amazon account (for amazon drawer edit mode)
  editingAmazonAccount?: AmazonAccountPublicDto | null;
  // Buyer message templates (Store Configuration → manage/create/edit)
  buyerMessageTemplates: BuyerMessageTemplate[];
  editingTemplateId?: string | null;
  onManageBuyerMessageTemplates: () => void;
  onCreateBuyerMessageTemplate: () => void;
  onEditBuyerMessageTemplate: (id: string) => void;
  onBackToBuyerMessageTemplateList: () => void;
  // Return from the amazon add/edit drawer to the accounts list drawer.
  onBackToAmazonList?: () => void;
  // Store settings flow: shared scope + nested blacklist navigation.
  storeScope: string;
  onSelectStoreScope: (value: string) => void;
  onManageBlacklist: () => void;
  onBackToStoreSettings: () => void;
}
