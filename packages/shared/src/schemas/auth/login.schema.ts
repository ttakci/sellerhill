/**
 * Login Form Validation Schema
 * Used by React Hook Form on frontend
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';
import { AUTH_CONSTANTS } from '../../domain/auth/auth.constants';

export const loginFormDataSchema = (t: TFunction) =>
  z.object({
    email: z
      .string()
      .email(t('translation:validation.invalidEmail'))
      .max(
        AUTH_CONSTANTS.EMAIL_MAX_LENGTH,
        t('translation:validation.maxLength', { max: AUTH_CONSTANTS.EMAIL_MAX_LENGTH })
      ),
    password: z
      .string()
      .min(1, t('translation:validation.required')),
  });

export type LoginFormData = z.infer<ReturnType<typeof loginFormDataSchema>>;
