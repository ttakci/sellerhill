import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { ProfileDto, UpdateProfileRequest } from '@repo/shared';
import { UserStatus } from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';

interface UserEntity {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  avatar_url: string | null;
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
  }

  private async ensureColumnsExist() {
    try {
      this.logger.log('Checking for profile-related columns in users table...');
      
      // Add phone_number if not exists
      await this.databaseService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)
      `);
      
      // Add avatar_url if not exists
      await this.databaseService.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT
      `);
      
      this.logger.log('Profile-related columns ensured.');
    } catch (error) {
      this.logger.error('Failed to ensure profile-related columns', error);
    }
  }

  async getProfile(userId: string): Promise<ProfileDto> {
    const users = await this.databaseService.query<UserEntity>(
      'SELECT id, first_name, last_name, email, phone_number, avatar_url, email_verified, status, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      throw new NotFoundException('User not found');
    }

    return this.mapToDto(users[0]);
  }

  async updateProfile(userId: string, request: UpdateProfileRequest): Promise<ProfileDto> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.firstName !== undefined) {
      updates.push(`first_name = $${paramIndex++}`);
      values.push(request.firstName);
    }

    if (request.lastName !== undefined) {
      updates.push(`last_name = $${paramIndex++}`);
      values.push(request.lastName);
    }

    if (request.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramIndex++}`);
      values.push(request.phoneNumber);
    }

    if (request.avatarUrl !== undefined) {
      updates.push(`avatar_url = $${paramIndex++}`);
      values.push(request.avatarUrl);
    }

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
      emailVerified: user.email_verified,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };
  }
}
