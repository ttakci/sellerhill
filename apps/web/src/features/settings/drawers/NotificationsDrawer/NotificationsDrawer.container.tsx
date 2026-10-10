import {
  DEFAULT_DIGEST_SEND_HOUR,
  DIGEST_SEND_HOUR_MAX,
  DIGEST_SEND_HOUR_MIN,
  type UpdateProfileRequest,
} from '@repo/shared';
import { useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { notifyDrawerDone } from '../shared/notifyDrawerDone';

import { NotificationsDrawerComponent } from './NotificationsDrawer.component';
import type { NotificationsDrawerProps, NotificationsHourOption } from './NotificationsDrawer.types';

import { useUpdateProfileMutation } from '@/features/profile/api/profileApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

const UTC_FALLBACK = 'UTC';

export const NotificationsDrawer: React.FC<NotificationsDrawerProps> = ({
  isOpen,
  onClose,
  profile,
  onOpenProfile,
}) => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const [updateProfile, { isLoading }] = useUpdateProfileMutation();

  // The summary is on by default for every account, so that is the fallback.
  const [digestEnabled, setDigestEnabled] = useState(profile?.digestEnabled ?? true);
  const [digestSendHour, setDigestSendHour] = useState(profile?.digestSendHour ?? DEFAULT_DIGEST_SEND_HOUR);

  // The drawer stays mounted. It adopts the profile ONCE per opening — on the
  // open transition, or when the profile arrives after it (the e-mail's
  // `?drawer=notifications` link opens it before the profile query returns,
  // and saving the fallback would overwrite the seller's real choice). A
  // refetch while it is open must not clobber unsaved edits.
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [adopted, setAdopted] = useState(false);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    setAdopted(false);
  }
  if (isOpen && !adopted && profile) {
    setAdopted(true);
    setDigestEnabled(profile.digestEnabled);
    setDigestSendHour(profile.digestSendHour);
  }

  const hourOptions = useMemo<NotificationsHourOption[]>(() => {
    const options: NotificationsHourOption[] = [];
    for (let hour = DIGEST_SEND_HOUR_MIN; hour <= DIGEST_SEND_HOUR_MAX; hour += 1) {
      options.push({ value: hour, label: `${String(hour).padStart(2, '0')}:00` });
    }
    return options;
  }, []);

  const handleHourChange = useCallback((value: string | number): void => setDigestSendHour(Number(value)), []);

  const handleSave = useCallback((): void => {
    // Nothing to save over until the seller's own choice has been read.
    if (!profile) {
      return;
    }
    const payload: UpdateProfileRequest = { digestEnabled, digestSendHour };
    void updateProfile(payload)
      .unwrap()
      .then(() => {
        notifyDrawerDone({ onClose, showMessage, closeMessage, t });
      })
      .catch((err: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:common.error',
            descriptionKey: getErrorI18nKey(err as Parameters<typeof getErrorI18nKey>[0]),
          },
          t
        );
      });
  }, [profile, digestEnabled, digestSendHour, updateProfile, onClose, showMessage, closeMessage, t]);

  return (
    <NotificationsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      digestEnabled={digestEnabled}
      digestSendHour={digestSendHour}
      hourOptions={hourOptions}
      timezone={profile?.timezone || UTC_FALLBACK}
      isSaving={isLoading}
      onDigestEnabledChange={setDigestEnabled}
      onDigestSendHourChange={handleHourChange}
      onOpenProfile={onOpenProfile}
      onSave={handleSave}
    />
  );
};

NotificationsDrawer.displayName = 'NotificationsDrawer';
