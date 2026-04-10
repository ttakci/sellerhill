/**
 * Register Form Validation Schema
 * Used by React Hook Form on frontend
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';
import { AUTH_CONSTANTS } from '../../domain/auth/auth.constants';

export const registerFormDataSchema = (t: TFunction) =>
  z
    .object({
      firstName: z
        .string()
        .min(
          AUTH_CONSTANTS.FIRST_NAME_MIN_LENGTH,
          t('translation:validation.minLength', { min: AUTH_CONSTANTS.FIRST_NAME_MIN_LENGTH })
        )
        .max(
          AUTH_CONSTANTS.FIRST_NAME_MAX_LENGTH,
          t('translation:validation.maxLength', { max: AUTH_CONSTANTS.FIRST_NAME_MAX_LENGTH })
        ),
      lastName: z
        .string()
        .min(
          AUTH_CONSTANTS.LAST_NAME_MIN_LENGTH,
          t('translation:validation.minLength', { min: AUTH_CONSTANTS.LAST_NAME_MIN_LENGTH })
        )
        .max(
          AUTH_CONSTANTS.LAST_NAME_MAX_LENGTH,
          t('translation:validation.maxLength', { max: AUTH_CONSTANTS.LAST_NAME_MAX_LENGTH })
        ),
      email: z
        .string()
        .email(t('translation:validation.invalidEmail'))
        .max(
          AUTH_CONSTANTS.EMAIL_MAX_LENGTH,
          t('translation:validation.maxLength', { max: AUTH_CONSTANTS.EMAIL_MAX_LENGTH })
        ),
      password: z
        .string()
        .min(
          AUTH_CONSTANTS.PASSWORD_MIN_LENGTH,
          t('translation:validation.minLength', { min: AUTH_CONSTANTS.PASSWORD_MIN_LENGTH })
        )
        .max(
          AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
          t('translation:validation.maxLength', { max: AUTH_CONSTANTS.PASSWORD_MAX_LENGTH })
        )
        .regex(
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
          t('translation:validation.passwordStrength')
        ),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('translation:validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

export type RegisterFormData = z.infer<ReturnType<typeof registerFormDataSchema>>;
