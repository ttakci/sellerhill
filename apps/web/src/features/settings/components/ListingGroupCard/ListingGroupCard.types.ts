import type { ListingSettingsGroupResponse } from '@repo/shared';

export interface ListingGroupCardProps {
  group: ListingSettingsGroupResponse;
  /** Called with the group id when the card is clicked or activated by keyboard. */
  onClick: (id: string) => void;
  /**
   * Resolved display name of the predefined template this group uses.
   * Undefined for custom templates (or while the predefined list is still loading).
   */
  templateName?: string;
  /** When true, renders the card in its selected (highlighted) state. */
  selected?: boolean;
}
