/**
 * Auth Domain Types
 * Single source of truth for authentication types across frontend/backend
 */

import type { SupportedLocale } from '../common/common.constants';

import type { UserDto } from './auth.dto';

/**
 * User registration request
 */
export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  locale?: SupportedLocale;
}

/**
 * User login request
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication response with tokens.
 * Refresh token is delivered via HttpOnly cookie (`sellerhill_rt`) and is **not**
 * returned in the JSON body in the cookie-auth path (optional for legacy only).
 */
export interface AuthResponse {
  accessToken: string;
  /** @deprecated Prefer HttpOnly cookie; omitted when cookie auth is enabled */
  refreshToken?: string;
  user: UserDto;
}

/**
 * JWT token payload
 */
export enum UserRole {
  CUSTOMER = 'customer',
  SUPPORT = 'support',
  ADMIN = 'admin',
}

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  sessionId: string;
  sessionVersion: number;
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
  locale?: SupportedLocale;
}

/**
 * Request a password-reset email.
 * The response is deliberately identical whether or not an account exists.
 */
export interface ForgotPasswordRequest {
  email: string;
  locale?: SupportedLocale;
}

/**
 * Complete a password reset with the opaque token from the emailed link.
 */
export interface ResetPasswordRequest {
  token: string;
  password: string;
}

/**
 * Generic acknowledgement for a reset request (carries an i18n key only —
 * never reveals whether an email was actually sent).
 */
export interface PasswordResetRequestResponse {
  message: string; // i18n key
}

/**
 * Refresh token request body (optional — cookie is preferred).
 */
export interface RefreshTokenRequest {
  /** @deprecated Prefer HttpOnly cookie `sellerhill_rt` */
  refreshToken?: string;
}

/**
 * Authenticated request with JWT user payload
 * Used by NestJS controllers with @Request() decorator
 */
export interface AuthenticatedRequest {
  user: JwtPayload;
}

/**
 * Change password request payload
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Generic success response (no data)
 */
export interface GenericSuccessResponse {
  success: boolean;
}

/**
 * OAuth identity providers stored in user_oauth_accounts.provider.
 * Only GOOGLE is implemented; schema is multi-provider-ready.
 */
export enum OAuthProvider {
  GOOGLE = 'google',
}

/**
 * Body for POST /auth/google (GIS popup auth-code exchange).
 */
export interface GoogleAuthRequest {
  code: string;
  locale?: SupportedLocale;
}
