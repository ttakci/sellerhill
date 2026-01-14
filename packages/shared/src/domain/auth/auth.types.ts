/**
 * Auth Domain Types
 * Single source of truth for authentication types across frontend/backend
 */

import type { UserDto } from './auth.dto';

/**
 * User registration request
 */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

/**
 * User login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication response with tokens
 */
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

/**
 * JWT token payload
 */
export interface JwtPayload {
  sub: string; // userId
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Registration response (without tokens)
 * User must verify email before receiving tokens
 */
export interface RegistrationResponse {
  message: string; // i18n key
  email: string;
}

/**
 * Email verification request
 */
export interface VerifyEmailRequest {
  token: string;
}

/**
 * Resend verification email request
 */
export interface ResendVerificationRequest {
  email: string;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}
