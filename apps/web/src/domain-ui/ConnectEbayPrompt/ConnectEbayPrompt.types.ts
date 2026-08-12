export interface ConnectEbayPromptProps {
  onConnect: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
  /** Extra caption rendered under the actions — e.g. the onboarding flow's marketplace-support note. */
  footnote?: string;
  className?: string;
}
