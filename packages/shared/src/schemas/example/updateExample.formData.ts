/**
 * Update Example Form Data Type
 * 
 * Purpose:
 * - Type definition for the "Update Example" form
 * - Used by web/mobile apps
 * - Separate from API DTOs (domain layer)
 */

import { EXAMPLE_STATUS } from '../../domain/example/example.constants';

export type UpdateExampleFormData = {
  name?: string;
  status?: typeof EXAMPLE_STATUS.ACTIVE | typeof EXAMPLE_STATUS.ARCHIVED;
};
