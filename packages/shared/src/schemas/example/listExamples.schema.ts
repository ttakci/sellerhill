/**
 * List Examples Filter/Search Schema
 *
 * Purpose:
 * - Validates the list/filter form for examples
 * - Used for search and pagination controls
 * - Typically used in data tables or list views
 * - i18n support for error messages
 *
 * Usage:
 * ```typescript
 * import { useForm } from 'react-hook-form';
 * import { zodResolver } from '@hookform/resolvers/zod';
 * import { listExamplesFilterDataSchema } from '@repo/shared';
 * import { useTranslation } from 'react-i18next';
 *
 * const { t } = useTranslation();
 * const filterForm = useForm({
 *   resolver: zodResolver(listExamplesFilterDataSchema(t)),
 *   defaultValues: { page: 1, limit: 10 }
 * });
 * ```
 */

import { z } from 'zod';

import { createFormValidators } from '../common/form.utils';

/**
 * List Examples Filter Data Schema Factory
 * Returns a Zod schema with i18n-enabled validation messages
 *
 * @param t - Translation function from i18next or similar
 * @returns Zod schema with translated error messages
 */
export const listExamplesFilterDataSchema = (t: (key: string) => string) => {
  const formValidators = createFormValidators(t);

  const schema = z.object({
    q: formValidators.searchQuery,
    page: formValidators.pageNumber,
    limit: formValidators.limitPerPage(),
  });

  return schema;
};
