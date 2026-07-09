import type { ProfileDto } from '@repo/shared';

export interface ProfileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileDto | undefined;
}
