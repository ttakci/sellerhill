export interface LinkResult {
  success: boolean;
  message: string;
}

export interface LinkAmazonModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onLinked: () => void;
}
