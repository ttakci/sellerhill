import type { ListingSettingsGroupResponse } from '@repo/shared';

export interface ListingSettingsGroupPageProps {
  groups: ListingSettingsGroupResponse[];
  onCreateGroup: () => void;
  onEditGroup: (id: string) => void;
  onDeleteGroup: (id: string) => void;
}
