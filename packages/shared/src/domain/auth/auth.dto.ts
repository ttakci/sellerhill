import type { SupportedLocale } from '../common/common.constants';
import { UserStatus } from '../user/user.types';

import { UserRole } from './auth.types';

/**
 * Auth Domain DTOs
 * Used by backend for class-validator decorators
 */

export class RegisterRequestDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  password!: string;
  locale?: SupportedLocale;
}

export class LoginRequestDto {
  email!: string;
  password!: string;
}

export class UserDto {
  id!: string;
  firstName!: string;
  lastName!: string;
  email!: string;
  emailVerified!: boolean;
  status!: UserStatus;
  role!: UserRole;
  sessionVersion!: number;
  locale!: SupportedLocale;
  hasConnectedAccounts!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  /** Omitted when refresh is set via HttpOnly cookie */
  refreshToken?: string;
  user!: UserDto;
}

export class RefreshTokenRequestDto {
  /** Optional — HttpOnly cookie is preferred */
  refreshToken?: string;
}

export class ChangePasswordRequestDto {
  currentPassword!: string;
  newPassword!: string;
}

export class GenericSuccessResponseDto {
  success!: boolean;
}
