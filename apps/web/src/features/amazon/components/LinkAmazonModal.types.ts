export interface LinkResult {
  success: boolean;
  message: string;
  linked?: boolean;
  reason?: 'cost_capture_failed';
}

export interface LinkAmazonModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onLinked: () => void;
}
