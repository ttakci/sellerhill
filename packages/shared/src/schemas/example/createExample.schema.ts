/**
 * Create Example Form Schema
 *
 * Purpose:
 * - Validates the "Create Example" form
 * - Used by web/mobile apps for form validation
 * - User-friendly error messages with i18n support
 *
 * Usage:
 * ```typescript
 * import { useForm } from 'react-hook-form';
 * import { zodResolver } from '@hookform/resolvers/zod';
 * import { createExampleFormDataSchema } from '@repo/shared';
 * import { useTranslation } from 'react-i18next';
 *
 * const { t } = useTranslation();
 * const form = useForm({
 *   resolver: zodResolver(createExampleFormDataSchema(t))
 * });
 * ```
 *
 * Platform Extension:
 * If you need platform-specific fields, extend this schema:
 * ```typescript
 * const webSchema = createExampleFormDataSchema(t).extend({
 *   agreeToTerms: z.boolean(),
 * });
 * ```
 */

import { z } from 'zod';

import { createDomainValidators } from '../common/form.utils';

/**
 * Create Example Form Data Schema Factory
 * Returns a Zod schema with i18n-enabled validation messages
 *
 * @param t - Translation function from i18next or similar
 * @returns Zod schema with translated error messages
 */
export const createExampleFormDataSchema = (t: (key: string) => string) => {
  const domainValidators = createDomainValidators(t);

  const schema = z.object({
    name: domainValidators.exampleName,
  });

  return schema;
};
