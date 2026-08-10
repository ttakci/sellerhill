import type { BlacklistType } from '@repo/shared';

export interface BlacklistCardProps {
  keyword: string;
  types: BlacklistType[];
  onRemove: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}
