import type { BlacklistAction, BlacklistType } from '@repo/shared';

export interface BlacklistCardProps {
  keyword: string;
  types: BlacklistType[];
  /** Absent = block. A removed word is marked so it is not mistaken for a blocking one. */
  action?: BlacklistAction;
  onRemove: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}
