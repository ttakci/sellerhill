import type { ProfileDto } from '@repo/shared';

export interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileDto | undefined;
  /** Switches to the profile drawer, where the time zone is changed. */
  onOpenProfile: () => void;
}

export interface NotificationsHourOption {
  value: number;
  label: string;
}

/** Presentation props: the container owns the draft and the save mutation. */
export interface NotificationsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  digestEnabled: boolean;
  digestSendHour: number;
  hourOptions: NotificationsHourOption[];
  timezone: string;
  isSaving: boolean;
  onDigestEnabledChange: (enabled: boolean) => void;
  onDigestSendHourChange: (value: string | number) => void;
  onOpenProfile: () => void;
  onSave: () => void;
}
