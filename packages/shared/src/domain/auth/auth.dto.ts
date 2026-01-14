import { UserStatus } from '../user/user.types';

/**
 * Auth Domain DTOs
 * Used by backend for class-validator decorators
 */

export class RegisterRequestDto {
  firstName!: string;
  lastName!: string;
  email!: string;
  password!: string;
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
  hasConnectedAccounts!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class AuthResponseDto {
  accessToken!: string;
  refreshToken!: string;
  user!: UserDto;
}

export class RefreshTokenRequestDto {
  refreshToken!: string;
}
