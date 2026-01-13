/**
 * RegisterPage Types
 */

import type { RegisterFormData } from '@repo/shared';

export interface RegisterPageComponentProps {
  onSubmit: (data: RegisterFormData) => void;
  isLoading: boolean;
  onNavigateToLogin: () => void;
}
