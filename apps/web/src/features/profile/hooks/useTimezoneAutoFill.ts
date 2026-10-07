import { useEffect, useRef } from 'react';

import { useGetProfileQuery, useUpdateProfileMutation } from '../api/profileApi';

import { isDemoMode } from '@/features/demo/demoMode';

/**
 * Fills users.timezone ONCE from the browser when it is empty. Never overwrites
 * a set value (a travelling seller's "yesterday" must not move). Fail-soft.
 */
export function useTimezoneAutoFill(enabled: boolean): void {
  const { data: profile } = useGetProfileQuery(undefined, { skip: !enabled || isDemoMode() });
  const [updateProfile] = useUpdateProfileMutation();
  const sent = useRef(false);

  useEffect(() => {
    if (!profile || profile.timezone || sent.current) {
      return;
    }
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) {
      return;
    }
    sent.current = true;
    updateProfile({ timezone })
      .unwrap()
      .catch(() => undefined);
  }, [profile, updateProfile]);
}
