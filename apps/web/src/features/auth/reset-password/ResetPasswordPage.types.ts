/**
 * ResetPasswordPage Types
 */

import type { ResetPasswordFormData } from '@repo/shared';

export type ResetPasswordStatus = 'form' | 'success' | 'error';

export interface ResetPasswordPageComponentProps {
  status: ResetPasswordStatus;
  isLoading: boolean;
  onSubmit: (data: ResetPasswordFormData) => void;
  onRequestNewLink: () => void;
  onNavigateToLogin: () => void;
}
