import type { ChangeEvent } from 'react';

export interface FilePickerProps {
  accept?: string;
  disabled?: boolean;
  fileName?: string;
  label: string;
  hint?: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}
