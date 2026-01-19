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
  taxId?: string;
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
  taxId?: string;
}
