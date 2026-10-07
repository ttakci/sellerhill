import { useEffect, useState } from 'react';

/**
 * Whether this tab is in front (`document.visibilityState === 'visible'`).
 * Polls that cost eBay quota pass `pollingInterval: visible ? N : 0`, so a tab
 * left open in the background stops spending the per-application pool every
 * seller shares; the poll resumes, and refetches, when the seller comes back.
 */
export function usePageVisible(): boolean {
  const [visible, setVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden'
  );

  useEffect(() => {
    const handleChange = (): void => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', handleChange);
    return () => document.removeEventListener('visibilitychange', handleChange);
  }, []);

  return visible;
}
