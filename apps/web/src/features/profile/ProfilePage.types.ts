import type { ProfileDto, UpdateProfileFormData } from '@repo/shared';

export interface ProfilePageComponentProps {
  profile: ProfileDto;
  onSubmit: (data: UpdateProfileFormData) => Promise<void>;
  isLoading: boolean;
}
