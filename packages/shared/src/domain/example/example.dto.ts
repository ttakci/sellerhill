import type { ExampleStatus } from './example.constants';

/**
 * Base Example Item
 * Shared model for example data
 */
export type ExampleItem = {
  id: string;
  name: string;
  status: ExampleStatus;
  createdAt: string;
  updatedAt: string;
};

/**
 * Pagination Metadata
 */
export type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

// ============================================================================
// Get Examples (List)
// ============================================================================

export type GetExamplesRequest = {
  q?: string;
  page?: number;
  limit?: number;
};

export type GetExamplesResponse = {
  data: ExampleItem[];
  pagination: PaginationMeta;
};

// ============================================================================
// Create Example
// ============================================================================

export type CreateExampleRequest = {
  name: string;
};

export type CreateExampleResponse = ExampleItem;

// ============================================================================
// Update Example
// ============================================================================

export type UpdateExampleRequest = {
  name?: string;
  status?: ExampleStatus;
};

export type UpdateExampleResponse = ExampleItem;

// ============================================================================
// Delete Example
// ============================================================================

export type DeleteExampleRequest = {
  id: string;
};

export type DeleteExampleResponse = {
  success: boolean;
  message?: string;
};
