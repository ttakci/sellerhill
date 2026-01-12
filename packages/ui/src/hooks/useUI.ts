import { useContext } from 'react';

import { UIContext } from '../context/UIContext';
import type { UIContextValue } from '../context/UIContext.types';

/**
 * Hook to access UI context (Message, Loading)
 * Platform-agnostic: Works on Web & Mobile
 *
 * @throws Error if used outside UIProvider
 * @returns UIContextValue
 *
 * @example
 * ```typescript
 * const { showMessage, showLoading, hideLoading } = useUI();
 *
 * showLoading({ overlay: true });
 * showMessage({ type: 'success', headerKey: 'success', descriptionKey: 'done' }, t);
 * ```
 */
export const useUI = (): UIContextValue => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
};
