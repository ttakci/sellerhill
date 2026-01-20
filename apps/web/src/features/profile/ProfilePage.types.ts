import type { ProfileDto, UpdateProfileFormData } from '@repo/shared';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';

export interface ProfilePageComponentProps {
  profile: ProfileDto;
  register: UseFormRegister<UpdateProfileFormData>;
  errors: FieldErrors<UpdateProfileFormData>;
  onSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isLoading: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
}
