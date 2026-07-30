import type { ProfileDto } from '@repo/shared';
import type React from 'react';

export interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileDto | undefined;
}

/** Presentation props — the container owns all state and the save mutation. */
export interface ProfileDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  isSaving: boolean;
  onFirstNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onLastNameChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPhoneNumberChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSave: () => void;
}
