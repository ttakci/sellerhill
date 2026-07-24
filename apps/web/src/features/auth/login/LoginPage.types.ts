/**
 * LoginPage Types
 */

import type { LoginFormData } from '@repo/shared';

export interface LoginPageComponentProps {
  onSubmit: (data: LoginFormData) => void;
  isLoading: boolean;
  onNavigateToRegister: () => void;
  onGoogleSignIn: () => void;
  isGoogleLoading: boolean;
  googleEnabled: boolean;
}
