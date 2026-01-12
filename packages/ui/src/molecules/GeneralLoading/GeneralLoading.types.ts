export type LoadingSize = 'small' | 'medium' | 'large';

export interface GeneralLoadingProps {
  isLoading: boolean;
  size?: LoadingSize;
  overlay?: boolean;
}
