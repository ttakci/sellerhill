/**
 * EbayConnectPage Types
 */

export interface EbayConnectPageComponentProps {
  onConnect: () => void;
  isLoading: boolean;
  connectedAccounts: number;
}
