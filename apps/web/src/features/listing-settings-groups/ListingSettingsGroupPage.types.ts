import type { ListingSettingsGroupResponse } from '@repo/shared';

export interface ListingSettingsGroupPageProps {
  groups: ListingSettingsGroupResponse[];
  /** Initial fetch — rendered as a page-level state, never the global overlay. */
  isLoading: boolean;
  onCreateGroup: () => void;
  onEditGroup: (id: string) => void;
  onDeleteGroup: (id: string) => void;
}
