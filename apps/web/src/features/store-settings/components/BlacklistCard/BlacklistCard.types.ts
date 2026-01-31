export interface BlacklistCardProps {
  keyword: string;
  scope: 'both' | 'title' | 'description';
  onRemove: () => void;
}
