/**
 * User Domain Types
 */

import type { SupportedLocale } from '../common/common.constants';

/**
 * User status enum
 */
export enum UserStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
}

/**
 * User types
 */
export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  emailVerified: boolean;
  locale: SupportedLocale;
  createdAt: string;
  updatedAt: string;
}
