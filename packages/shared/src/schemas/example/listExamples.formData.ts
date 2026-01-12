/**
 * List Examples Filter Data Type
 * 
 * Purpose:
 * - Type definition for the "List Examples" filter/search form
 * - Used by web/mobile apps
 * - Separate from API DTOs (domain layer)
 */

export type ListExamplesFilterData = {
  q?: string;
  page?: number;
  limit?: number;
};
