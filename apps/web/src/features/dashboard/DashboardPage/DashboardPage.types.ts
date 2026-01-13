/**
 * DashboardPage Types
 */

import type { UserDto } from '@repo/shared';

export interface DashboardPageComponentProps {
  user: UserDto | null;
  isLoading: boolean;
  onConnectEbay: () => void;
}
