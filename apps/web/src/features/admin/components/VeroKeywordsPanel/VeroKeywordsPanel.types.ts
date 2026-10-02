import type { AdminVeroKeywordDto } from '@repo/shared';

export interface VeroKeywordsPanelProps {
  /** True until the admin role is confirmed — nothing is fetched before then. */
  skip: boolean;
}

export interface VeroKeywordsPanelComponentProps {
  items: AdminVeroKeywordDto[];
  total: number;
  search: string;
  onSearchChange: (value: string) => void;
  draft: string;
  onDraftChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onAdd: () => void;
  isAdding: boolean;
  /** Result of the last add ("12 added, 3 already on the list"); empty until one has run. */
  addResult: string;
  onRemove: (id: string) => void;
  removingId: string | null;
  page: number;
  pageCount: number;
  onPreviousPage: () => void;
  onNextPage: () => void;
}
