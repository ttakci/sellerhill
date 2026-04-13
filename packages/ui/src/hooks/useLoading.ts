import { useEffect } from 'react';

import type { ShowLoadingOptions } from '../context/UIContext.types';

import { useUI } from './useUI';

/**
 * Hook to automatically handle global loading state based on a boolean value.
 * Useful for syncing RTK Query isLoading/isFetching with the global loading overlay.
 * 
 * @param isLoading Boolean state to sync with global loading
 * @param options Optional configuration for the loading overlay
 */
export const useLoading = (isLoading: boolean, options?: ShowLoadingOptions) => {
  const { showLoading, hideLoading } = useUI();

  useEffect(() => {
    if (isLoading) {
      showLoading(options);
    } else {
      hideLoading();
    }
    
    // Safety: ensure loading is hidden when component unmounts
    return () => {
      if (isLoading) {
        hideLoading();
      }
    };
  }, [isLoading, showLoading, hideLoading, options]);
};
