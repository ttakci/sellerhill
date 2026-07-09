export interface DeactivateAccountModalComponentProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  confirmInput: string;
  onConfirmInputChange: (value: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export interface DeactivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}
