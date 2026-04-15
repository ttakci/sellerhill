import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
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
export class ProfileService implements OnModuleInit {
  private readonly logger = new Logger(ProfileService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    await this.ensureColumnsExist();
    await this.dropDeprecatedColumns();
  }

  private async ensureColumnsExist() {
    try {
      this.logger.log('Checking for profile-related columns in users table...');
      
      const columns = [
        'phone_number VARCHAR(20)',
        'avatar_url TEXT',
        'job_title TEXT',
        'bio TEXT',
        'country TEXT',
        'city_state TEXT',
        'postal_code TEXT'
      ];

      for (const columnDef of columns) {
         await this.databaseService.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS ${columnDef}
         `);
      }
      
      this.logger.log('Profile-related columns ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure profile-related columns', error);
    }
  }

  private async dropDeprecatedColumns() {
    try {
      this.logger.log('Dropping deprecated columns (tax_id, social_links)...');
      await this.databaseService.query(`
        ALTER TABLE users 
        DROP COLUMN IF EXISTS tax_id,
        DROP COLUMN IF EXISTS social_links
      `);
      this.logger.log('Deprecated columns dropped.');
    } catch (error) {
      this.logger.error('Failed to drop deprecated columns', error);
    }
  }

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
             updates.push(`${dbField} = $${paramIndex++}`);
             values.push(value as string | number | boolean | null);
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
