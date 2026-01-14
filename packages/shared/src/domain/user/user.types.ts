/**
 * User Domain Types
 */

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
  createdAt: string;
  updatedAt: string;
}
