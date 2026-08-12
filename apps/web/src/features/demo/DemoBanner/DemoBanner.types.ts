export interface DemoBannerProps {
  label: string;
  description: string;
  exitLabel: string;
  signUpLabel: string;
  onExit: () => void;
  onSignUp: () => void;
}
