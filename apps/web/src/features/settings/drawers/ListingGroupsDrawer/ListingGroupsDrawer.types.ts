import type { ListingSettingsGroupResponse } from '@repo/shared';

export interface ListingGroupsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ListingSettingsGroupResponse[];
  /** predefinedTemplateId → display name (for the template badge on each card). */
  predefinedTemplateNames: Record<string, string>;
  onEdit: (id: string) => void;
  /** Opens the create-group flow. */
  onCreate: () => void;
  /** Opens the full "all groups" list drawer. */
  onViewAll: () => void;
}

export interface ListingGroupsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ListingSettingsGroupResponse[];
  predefinedTemplateNames: Record<string, string>;
  /** Opens the edit flow for a group by id. */
  onEdit: (id: string) => void;
  onCreate: () => void;
  onViewAll: () => void;
  titleLabel: string;
  subtitleLabel: string;
  viewAllLabel: string;
  createTitle: string;
  createSubtitle: string;
  emptyTitle: string;
  emptyDescription: string;
}
