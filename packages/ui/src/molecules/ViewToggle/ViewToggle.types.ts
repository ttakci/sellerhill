export type ViewMode = 'grid' | 'table';

export interface ViewToggleProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  gridLabel?: string;
  tableLabel?: string;
}
