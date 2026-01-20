import { StoreSettingsFormData, StoreSettingsResponse } from '@repo/shared';
import { UseFormReturn } from 'react-hook-form';

export interface StoreSettingsPageProps {
  settings: StoreSettingsResponse;
  onSave: (data: StoreSettingsFormData) => void;
  onStoreChange: (storeId: string) => void;
  availableStores: Array<{ id: string; name: string }>;
  
  // Form
  form: UseFormReturn<StoreSettingsFormData>;
  
  // Blacklist Management
  newKeyword: string;
  setNewKeyword: (val: string) => void;
  newScope: 'title' | 'description' | 'both';
  setNewScope: (val: 'title' | 'description' | 'both') => void;
  onAddKeyword: () => void;
  onRemoveKeyword: (index: number) => void;
  
  // Pagination & Sorting
  pagedBlacklist: Array<{ keyword: string; scope: 'title' | 'description' | 'both' }>;
  page: number;
  setPage: (page: number) => void;
  rowsPerPage: number;
  setRowsPerPage: (rows: number) => void;
  onSort: (column: string) => void;
  sortColumn: string | undefined;
  sortDirection: 'asc' | 'desc';
  blacklistCount: number;
}
