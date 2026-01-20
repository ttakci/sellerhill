/**
 * EbayConnectPage Types
 */

export interface EbayConnectPageComponentProps {
  onConnect: () => void;
  connectedAccounts: number;
  isLoading?: boolean;
}
