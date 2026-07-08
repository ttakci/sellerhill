import type { AmazonAccountPublicDto } from '@repo/shared';

export interface AccountFormState {
  label: string;
  email: string;
  password: string;
  twoFactorSecret: string;
}

export interface AmazonAccountsPageComponentProps {
  accounts: AmazonAccountPublicDto[];
  isSaving: boolean;
  isVerifying: string | null;
  onAdd: (data: { label?: string; email: string; password: string; twoFactorSecret?: string }) => void;
  onEdit: (id: string, data: { label?: string; password?: string; twoFactorSecret?: string }) => void;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  editingAccount: AmazonAccountPublicDto | null;
  isAddModalOpen: boolean;
  onOpenAddModal: () => void;
  onCloseModal: () => void;
  formValues: AccountFormState;
  onFormChange: (field: keyof AccountFormState, value: string) => void;
  onSubmitForm: () => void;
}

export interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSaving: boolean;
  defaultValues?: { label?: string; email?: string } | null;
  title: string;
  formValues: AccountFormState;
  onFormChange: (field: keyof AccountFormState, value: string) => void;
  onSubmitForm: () => void;
}
