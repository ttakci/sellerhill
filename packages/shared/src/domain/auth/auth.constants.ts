/**
 * Auth Domain Constants
 */

export const AUTH_CONSTANTS = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 100,
  FIRST_NAME_MIN_LENGTH: 2,
  FIRST_NAME_MAX_LENGTH: 50,
  LAST_NAME_MIN_LENGTH: 2,
  LAST_NAME_MAX_LENGTH: 50,
  EMAIL_MAX_LENGTH: 255,

  JWT_ACCESS_TOKEN_EXPIRES_IN: '5m',
  REFRESH_SESSION_EXPIRES_IN_DAYS: 7,

  /** Password-reset link lifetime, in minutes. Single-use regardless. */
  PASSWORD_RESET_TOKEN_TTL_MINUTES: 60,
  /**
   * Minimum gap between two reset emails for the same account. A second
   * request inside this window is accepted (same generic response) but sends
   * nothing — the first link is still valid.
   */
  PASSWORD_RESET_COOLDOWN_SECONDS: 60,
} as const;

export type AuthConstantsType = typeof AUTH_CONSTANTS;
