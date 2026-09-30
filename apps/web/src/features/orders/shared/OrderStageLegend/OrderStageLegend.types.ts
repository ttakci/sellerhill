import type { OrderStage } from '@repo/shared';

export interface OrderStageLegendRow {
  stage: OrderStage;
  meaning: string;
  action: string | null;
}

export interface OrderStageLegendViewProps {
  rows: OrderStageLegendRow[];
  title: string;
  openLabel: string;
  columnStage: string;
  columnMeaning: string;
  columnAction: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}
