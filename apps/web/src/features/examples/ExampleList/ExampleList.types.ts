import { type ExampleItem } from '@repo/shared';

export interface ExampleListProps {
  items: ExampleItem[];
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isArchived: (status: string) => boolean;
}
