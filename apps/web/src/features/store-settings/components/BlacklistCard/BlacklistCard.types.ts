export interface BlacklistCardProps {
  keyword: string;
  scope: 'both' | 'title' | 'description';
  onRemove: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}
