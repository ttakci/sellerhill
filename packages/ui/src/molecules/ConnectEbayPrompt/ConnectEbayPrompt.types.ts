export interface ConnectEbayPromptProps {
  onConnect: () => void;
  onSkip?: () => void;
  isLoading?: boolean;
  className?: string;
}
