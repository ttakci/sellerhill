import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserStatus, type ProfileDto, type UpdateProfileRequest } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

interface UserEntity {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
  job_title: string | null;
  bio: string | null;
  country: string | null;
  city_state: string | null;
  postal_code: string | null;
  email_verified: boolean;
  status: UserStatus;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class ProfileService {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async getProfile(userId: string): Promise<ProfileDto> {
    const users = await this.databaseService.query<UserEntity>(
      'SELECT id, first_name, last_name, email, phone_number, avatar_url, job_title, bio, country, city_state, postal_code, email_verified, status, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      throw new NotFoundException('User not found');
    }

    return this.mapToDto(users[0]);
  }

  async updateProfile(userId: string, request: UpdateProfileRequest): Promise<ProfileDto> {
    const updates: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    const fieldsTemplate: Record<keyof UpdateProfileRequest, string> = {
        firstName: 'first_name',
        lastName: 'last_name',
        phoneNumber: 'phone_number',
        avatarUrl: 'avatar_url',
        jobTitle: 'job_title',
        bio: 'bio',
        country: 'country',
        cityState: 'city_state',
        postalCode: 'postal_code'
    };

    Object.entries(request).forEach(([key, value]) => {
        const dbField = fieldsTemplate[key as keyof UpdateProfileRequest];
        if (dbField && value !== undefined) {
             // An empty phone means "clear it" — store NULL so the column stays
             // E.164-or-nothing for any future consumer.
             const typedValue = value as string | number | boolean | null;
             const normalized = key === 'phoneNumber' && typedValue === '' ? null : typedValue;
             updates.push(`${dbField} = $${paramIndex++}`);
             values.push(normalized);
        }
    });

    if (updates.length === 0) {
      return this.getProfile(userId);
    }

    const setClause = updates.join(', ');
    const query = `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${paramIndex} RETURNING *`;
    values.push(userId);

    const users = await this.databaseService.query<UserEntity>(query, values);

    if (users.length === 0) {
      throw new NotFoundException('User not found during update');
    }

    return this.mapToDto(users[0]);
  }

  private mapToDto(user: UserEntity): ProfileDto {
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phoneNumber: user.phone_number || undefined,
      avatarUrl: user.avatar_url || undefined,
      jobTitle: user.job_title || undefined,
      bio: user.bio || undefined,
      country: user.country || undefined,
      cityState: user.city_state || undefined,
      postalCode: user.postal_code || undefined,
      emailVerified: user.email_verified,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };
  }
}
