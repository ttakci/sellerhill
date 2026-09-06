import { z } from 'zod';

type TranslationFunction = (key: string) => string;

export const updateProfileSchema = (t: TranslationFunction) =>
  z.object({
    firstName: z.string().min(2, t('auth.validation.firstNameMin')),
    lastName: z.string().min(2, t('auth.validation.lastNameMin')),
    phoneNumber: z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, t('validation.invalidPhone'))
      .or(z.literal(''))
      .optional()
      .nullable(),
    avatarUrl: z.string().url(t('common.validation.invalidUrl')).optional().nullable().or(z.literal('')),
    jobTitle: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    cityState: z.string().optional().nullable(),
    postalCode: z.string().optional().nullable(),
  });

export type UpdateProfileFormData = z.infer<ReturnType<typeof updateProfileSchema>>;
