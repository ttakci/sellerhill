import { z } from 'zod';

export const updateProfileSchema = (t: any) => z.object({
  firstName: z.string().min(2, t('auth.validation.firstNameMin')),
  lastName: z.string().min(2, t('auth.validation.lastNameMin')),
  phoneNumber: z.string().optional().nullable(),
  avatarUrl: z.string().url(t('common.validation.invalidUrl')).optional().nullable().or(z.literal('')),
  jobTitle: z.string().optional().nullable(),
  bio: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  cityState: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
});

export type UpdateProfileFormData = z.infer<ReturnType<typeof updateProfileSchema>>;
