import { useState, useCallback } from 'react';

import { GeneralLoading } from '../molecules/GeneralLoading/GeneralLoading.component';
import type { LoadingSize } from '../molecules/GeneralLoading/GeneralLoading.types';

interface LoadingState {
  isLoading: boolean;
  size?: LoadingSize;
  overlay?: boolean;
}

interface ShowLoadingOptions {
  size?: LoadingSize;
  overlay?: boolean;
}

export const useGeneralLoading = () => {
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isLoading: false,
  });

  const showLoading = useCallback((options?: ShowLoadingOptions) => {
    setLoadingState({
      isLoading: true,
      size: options?.size || 'medium',
      overlay: options?.overlay ?? true,
    });
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingState({
      isLoading: false,
    });
  }, []);

  const GeneralLoadingComponent = (
    <GeneralLoading isLoading={loadingState.isLoading} size={loadingState.size} overlay={loadingState.overlay} />
  );

  return {
    showLoading,
    hideLoading,
    GeneralLoadingComponent,
  };
};
