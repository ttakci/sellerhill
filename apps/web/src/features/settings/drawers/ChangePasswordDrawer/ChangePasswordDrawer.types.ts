import type React from 'react';

export interface ChangePasswordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Presentation props — the container owns validation state and the mutation. */
export interface ChangePasswordDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  error: string | null;
  isSaving: boolean;
  onCurrentPasswordChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onNewPasswordChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConfirmPasswordChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
}
