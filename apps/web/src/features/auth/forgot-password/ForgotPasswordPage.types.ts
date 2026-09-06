/**
 * ForgotPasswordPage Types
 */

import type { ForgotPasswordFormData } from '@repo/shared';

export interface ForgotPasswordPageComponentProps {
  onSubmit: (data: ForgotPasswordFormData) => void;
  isLoading: boolean;
  /** true once a request has been accepted — swaps the form for the confirmation panel. */
  submitted: boolean;
  submittedEmail: string;
  onResend: () => void;
  onBackToLogin: () => void;
}
