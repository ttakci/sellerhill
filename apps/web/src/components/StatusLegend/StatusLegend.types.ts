import type { BadgeVariant, IconName } from '@repo/ui';

export interface StatusLegendRow {
  key: string;
  label: string;
  variant: BadgeVariant;
  icon: IconName;
  meaning: string;
}

/** What a container hands over: each row's badge look and its explanation. */
export interface StatusLegendProps {
  rows: StatusLegendRow[];
}

export interface StatusLegendViewProps {
  rows: StatusLegendRow[];
  title: string;
  openLabel: string;
  columnStatus: string;
  columnMeaning: string;
  isOpen: boolean;
  onToggle: () => void;
}
