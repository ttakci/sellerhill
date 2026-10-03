import type { EbayBusinessPolicyDto, ListingSettingsGroup } from '@repo/shared';

export interface ExistingListingsImportDrawerProps { isOpen: boolean; onClose: () => void; onSuccess: (jobId: string) => void }
export interface ExistingListingsImportDrawerComponentProps {
  isOpen: boolean; step: 0 | 1; isLoading: boolean; canProceed: boolean; fileName?: string;
  /** The active store's name — the import goes there (top-bar switcher). */
  storeLabel: string; groups: ListingSettingsGroup[];
  policies: { payment: EbayBusinessPolicyDto[]; shipping: EbayBusinessPolicyDto[]; return: EbayBusinessPolicyDto[] };
  values: Record<string, string>; onValueChange: (name: string, value: string | number) => void;
  onFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onDownloadTemplate: () => void;
  onNext: () => void; onBack: () => void; onSubmit: () => void; onClose: () => void;
}
