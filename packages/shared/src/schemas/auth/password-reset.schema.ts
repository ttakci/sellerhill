/**
 * Password Reset Form Validation Schemas
 * Used by React Hook Form on the forgot-password / reset-password screens.
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';

import { AUTH_CONSTANTS } from '../../domain/auth/auth.constants';

/** "Enter your email to get a reset link" form. */
export const forgotPasswordSchema = (t: TFunction) =>
  z.object({
    email: z
      .string()
      .email(t('translation:validation.invalidEmail'))
      .max(
        AUTH_CONSTANTS.EMAIL_MAX_LENGTH,
        t('translation:validation.maxLength', { max: AUTH_CONSTANTS.EMAIL_MAX_LENGTH })
      ),
  });

export type ForgotPasswordFormData = z.infer<ReturnType<typeof forgotPasswordSchema>>;

/**
 * "Set a new password" form. Password rules are kept identical to
 * registerFormDataSchema so the two never drift. The token comes from the URL,
 * not this form.
 */
export const resetPasswordSchema = (t: TFunction) =>
  z
    .object({
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
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/, t('translation:validation.passwordStrength')),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('translation:validation.passwordMismatch'),
      path: ['confirmPassword'],
    });

export type ResetPasswordFormData = z.infer<ReturnType<typeof resetPasswordSchema>>;
