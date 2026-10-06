import { useLayoutEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';

import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';

/** Every observed context transition invalidates requests, including A → B → A. */
export function useCampaignRequestScope(storeId: string | null, campaignId: string | undefined) {
  const { activeStoreId } = useActiveStore();
  const route = useParams();
  const context = `${activeStoreId ?? ''}:${route.campaignId ?? ''}`;
  const generation = useRef({ context, value: 0, mounted: false });
  if (generation.current.context !== context) {
    generation.current.context = context;
    generation.current.value += 1;
  }
  useLayoutEffect(() => {
    generation.current.mounted = true;
    return () => {
      generation.current.mounted = false;
      generation.current.value += 1;
    };
  }, []);
  const begin = () => {
    const token = ++generation.current.value;
    return () =>
      generation.current.mounted &&
      generation.current.value === token &&
      generation.current.context === `${storeId ?? ''}:${campaignId ?? ''}`;
  };
  return {
    begin,
    isContextCurrent: () =>
      generation.current.mounted && generation.current.context === `${storeId ?? ''}:${campaignId ?? ''}`,
    cancel: () => {
      generation.current.value += 1;
    },
  };
}
