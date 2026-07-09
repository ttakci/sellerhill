/**
 * Change Password Form Validation Schema
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';

import { AUTH_CONSTANTS } from '../../domain/auth/auth.constants';

export const changePasswordSchema = (t: TFunction) =>
  z
    .object({
      currentPassword: z.string().min(1, t('translation:validation.required')),
      newPassword: z
        .string()
        .min(
          AUTH_CONSTANTS.PASSWORD_MIN_LENGTH,
          t('translation:settingsHub.drawer.password.tooShort')
        )
        .max(
          AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
          t('translation:validation.maxLength', {
            max: AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
          })
        ),
      confirmPassword: z.string().min(1, t('translation:validation.required')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('translation:settingsHub.drawer.password.mismatch'),
      path: ['confirmPassword'],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: t('translation:settingsHub.drawer.password.sameAsCurrent'),
      path: ['newPassword'],
    });

export type ChangePasswordFormData = z.infer<ReturnType<typeof changePasswordSchema>>;
