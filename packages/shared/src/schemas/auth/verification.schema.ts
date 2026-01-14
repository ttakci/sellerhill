/**
 * Email Verification Schema
 * Used by React Hook Form on frontend
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';

export const verifyEmailSchema = (t: TFunction) =>
  z.object({
    token: z.string().min(1, t('validation.required')),
  });

export type VerifyEmailFormData = z.infer<ReturnType<typeof verifyEmailSchema>>;

export const resendVerificationSchema = (t: TFunction) =>
  z.object({
    email: z.string().email(t('validation.invalidEmail')),
  });

export type ResendVerificationFormData = z.infer<ReturnType<typeof resendVerificationSchema>>;
