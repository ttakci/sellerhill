import { type ExampleItem, type CreateExampleFormData } from '@repo/shared';

export interface ExamplesPageProps {
  items: ExampleItem[];
  onCreateExample: (data: CreateExampleFormData) => void | Promise<void>;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  isArchived: (status: string) => boolean;
}
