/**
 * Update Example Form Schema
 *
 * Purpose:
 * - Validates the "Update Example" form
 * - Used by web/mobile apps for form validation
 * - All fields are optional (partial update)
 * - User-friendly error messages with i18n support
 *
 * Usage:
 * ```typescript
 * import { useForm } from 'react-hook-form';
 * import { zodResolver } from '@hookform/resolvers/zod';
 * import { updateExampleFormDataSchema } from '@repo/shared';
 * import { useTranslation } from 'react-i18next';
 *
 * const { t } = useTranslation();
 * const form = useForm({
 *   resolver: zodResolver(updateExampleFormDataSchema(t))
 * });
 * ```
 */

import { z } from 'zod';

import { EXAMPLE_STATUS } from '../../domain/example/example.constants';
import { createDomainValidators } from '../common/form.utils';

/**
 * Update Example Form Data Schema Factory
 * Returns a Zod schema with i18n-enabled validation messages
 *
 * @param t - Translation function from i18next or similar
 * @returns Zod schema with translated error messages
 */
export const updateExampleFormDataSchema = (t: (key: string) => string) => {
  const domainValidators = createDomainValidators(t);

  const schema = z.object({
    name: domainValidators.exampleNameOptional,
    status: z
      .enum([EXAMPLE_STATUS.ACTIVE, EXAMPLE_STATUS.ARCHIVED], {
        message: t('validation.invalidStatus'),
      })
      .optional(),
  });

  return schema;
};
