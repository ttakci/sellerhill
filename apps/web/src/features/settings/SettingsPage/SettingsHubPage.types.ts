import type {
  AmazonAccountPublicDto,
  BuyerMessageTemplate,
  EbayAccountPublicDto,
  EbayMarketplaceId,
  ListingSettingsGroupResponse,
  ProfileDto,
  StoreSettingsResponse,
} from '@repo/shared';

import type { EbayMarketplaceOption } from '@/domain-ui/ConnectEbayPrompt/ConnectEbayPrompt.types';

export type SettingsDrawerKey =
  | 'profile'
  | 'ebayAccounts'
  | 'ebayAccountsAll'
  | 'amazonAccounts'
  | 'amazonAccountsAll'
  | 'amazonAdd'
  | 'amazonEdit'
  | 'storeSettings'
  | 'storeBlacklist'
  | 'password'
  | 'listingGroupCreate'
  | 'listingGroupEdit'
  | 'listingGroupList'
  | 'listingGroupsAll'
  | 'buyerMessageTemplates'
  | 'buyerMessageTemplatesAll'
  | 'buyerMessageTemplateCreate'
  | 'buyerMessageTemplateEdit'
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
  ebayMarketplaceOptions: EbayMarketplaceOption[];
  selectedEbayMarketplace: EbayMarketplaceId;
  onEbayMarketplaceChange: (value: EbayMarketplaceId) => void;
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
  // Buyer message templates (Store Configuration → templates hub → carousel/all/create/edit)
  buyerMessageTemplates: BuyerMessageTemplate[];
  editingTemplateId?: string | null;
  onEditBuyerMessageTemplate: (id: string) => void;
  // Store settings flow: shared scope + nested blacklist navigation.
  storeScope: string;
  onSelectStoreScope: (value: string) => void;
  onManageBlacklist: () => void;
  onBackToStoreSettings: () => void;
}
