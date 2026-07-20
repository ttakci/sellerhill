import type { AmazonAccountPublicDto } from '@repo/shared';

export interface AccountFormState {
  label: string;
  email: string;
  password: string;
  twoFactorSecret: string;
  // A2 auto-fulfillment per-account overrides
  autoFulfillEnabled: boolean;
  autoFulfillCapTotal: string; // string for input binding; parsed on submit
  autoFulfillDryRun: boolean;
}

export interface AmazonAccountsPageComponentProps {
  accounts: AmazonAccountPublicDto[];
  isSaving: boolean;
  isVerifying: string | null;
  onDelete: (id: string) => void;
  onVerify: (id: string) => void;
  onSelectAccountForEdit: (account: AmazonAccountPublicDto) => void;
  editingAccount: AmazonAccountPublicDto | null;
  isAddModalOpen: boolean;
  onOpenAddModal: () => void;
  onCloseModal: () => void;
  formValues: AccountFormState;
  onFormChange: (field: keyof AccountFormState, value: string | boolean) => void;
  onSubmitForm: () => void;
}

export interface AccountFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSaving: boolean;
  defaultValues?: AmazonAccountPublicDto | null;
  title: string;
  formValues: AccountFormState;
  onFormChange: (field: keyof AccountFormState, value: string | boolean) => void;
  onSubmitForm: () => void;
}
