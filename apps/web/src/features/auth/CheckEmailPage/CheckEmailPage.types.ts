/**
 * CheckEmailPage Types
 */

export interface CheckEmailPageProps {
  email?: string;
  onResend: () => void;
  onBackToLogin: () => void;
  isResending: boolean;
}
