/**
 * Profile Domain Types
 */

/**
 * Profile DTO
 */
export interface ProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  avatarUrl?: string;
  jobTitle?: string;
  bio?: string;
  country?: string;
  cityState?: string;
  postalCode?: string;
  timezone?: string;
  /** The daily summary e-mail is on (default for every account). */
  digestEnabled: boolean;
  /** Local hour (in `timezone`) the daily summary goes out, DIGEST_SEND_HOUR_MIN..MAX. */
  digestSendHour: number;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update Profile Request
 */
export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  jobTitle?: string;
  bio?: string;
  country?: string;
  cityState?: string;
  postalCode?: string;
  timezone?: string;
  digestEnabled?: boolean;
  digestSendHour?: number;
}

/**
 * The daily summary e-mail reports the seller's previous full calendar day, so
 * it can only go out in the morning: before 05:00 the day's last orders are
 * often not synced yet, after 12:00 "yesterday" is stale news.
 */
export const DIGEST_SEND_HOUR_MIN = 5;
export const DIGEST_SEND_HOUR_MAX = 12;
export const DEFAULT_DIGEST_SEND_HOUR = 8;
