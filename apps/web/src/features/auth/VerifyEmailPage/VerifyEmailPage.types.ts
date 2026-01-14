export interface VerifyEmailPageProps {
  status: 'loading' | 'success' | 'error';
  email?: string;
  onResendVerification: () => void;
  onNavigateToLogin: () => void;
}
