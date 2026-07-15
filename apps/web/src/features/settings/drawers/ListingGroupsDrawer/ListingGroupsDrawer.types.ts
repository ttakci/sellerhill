import type { ListingSettingsGroupResponse } from '@repo/shared';

export interface ListingGroupsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ListingSettingsGroupResponse[];
  /** predefinedTemplateId → display name (for the template badge on each card). */
  predefinedTemplateNames: Record<string, string>;
  onEdit: (id: string) => void;
}

export interface ListingGroupsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  groups: ListingSettingsGroupResponse[];
  predefinedTemplateNames: Record<string, string>;
  /** Currently selected group id, or null when nothing is selected. */
  selectedId: string | null;
  /** True until a card is selected — disables the footer "Continue" action. */
  isContinueDisabled: boolean;
  /** Selects (or toggles off) a card by id. */
  onSelect: (id: string) => void;
  /** Opens the edit flow for the currently selected group. */
  onContinue: () => void;
  titleLabel: string;
  subtitleLabel: string;
  emptyTitle: string;
  emptyDescription: string;
}
