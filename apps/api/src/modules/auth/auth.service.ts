import { BadRequestException, ConflictException, HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AUTH_CONSTANTS,
  DEFAULT_LOCALE,
  UserStatus,
  type AuthResponse,
  type JwtPayload,
  type LoginRequest,
  type RegisterRequest,
  type RegistrationResponse,
  type SupportedLocale,
  type UserDto,
} from '@repo/shared';
import * as bcrypt from 'bcrypt';

import { DatabaseService } from '../../common/database/database.service';
import { EmailService } from '../email/email.service';

/**
 * User entity from database
 */
interface UserEntity {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  password_hash: string | null;
  email_verified: boolean;
  status: UserStatus;
  locale: string;
  email_verification_token?: string;
  email_verification_expiry?: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Register a new user
   * Sends verification email instead of returning tokens
   */
  async register(request: RegisterRequest): Promise<RegistrationResponse> {
    this.logger.log(`Registering user: ${request.email}`);

    // Check if email already exists
    const existingUsers = await this.databaseService.query<UserEntity>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [request.email]
    );

    if (existingUsers.length > 0) {
      throw new ConflictException('auth.errors.emailExists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(request.password, 10);

    // Generate email verification token (JWT with 30min expiry)
    const verificationToken = this.jwtService.sign(
      { email: request.email, type: 'email_verification' },
      { expiresIn: '30m' }
    );

    const verificationExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Determine locale (use provided locale or default)
    const userLocale = request.locale || DEFAULT_LOCALE;

    // Insert user into database
    const users = await this.databaseService.query<UserEntity>(
      `INSERT INTO users (first_name, last_name, email, password_hash, email_verified, status, locale, email_verification_token, email_verification_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        request.firstName,
        request.lastName,
        request.email,
        passwordHash,
        false,
        UserStatus.PENDING,
        userLocale,
        verificationToken,
        verificationExpiry.toISOString(),
      ]
    );

    const user = users[0];
    this.logger.log(`User created in database: ${user.id}`);

    // Send verification email in user's locale
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verificationUrl = `${frontendUrl}/${userLocale}/verify-email?token=${verificationToken}&email=${encodeURIComponent(request.email)}`;

    let message = 'auth.verification.emailSent';
    try {
      await this.emailService.sendVerificationEmail(user.email, user.first_name, verificationUrl, userLocale);
      this.logger.log(`Verification email sent to: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${user.email}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Don't fail registration if email fails, user can resend later
      message = 'auth.verification.emailFailed';
    }

    return {
      message,
      email: user.email,
    };
  }

  /**
   * Verify email with token
   */
  async verifyEmail(token: string): Promise<AuthResponse> {
    this.logger.log('Verifying email token');

    try {
      // Verify JWT token
      const payload = this.jwtService.verify<JwtPayload & { type: string }>(token);
      this.logger.debug('Token verified for email verification');

      if (payload.type !== 'email_verification') {
        throw new UnauthorizedException('auth.errors.invalid');
      }

      // Find user with this token
      const users = await this.databaseService.query<UserEntity>(
        `SELECT * FROM users 
         WHERE LOWER(email) = LOWER($1) 
         AND email_verification_token = $2 
         AND email_verification_expiry > NOW()`,
        [payload.email, token]
      );

      this.logger.debug(`Found ${users.length} users for email verification`);
      if (users.length === 0) {
        // Idempotency: if already verified (React Strict Mode / retries), return success
        const verifiedUsers = await this.databaseService.query<UserEntity>(
          `SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND email_verified = true`,
          [payload.email]
        );
        if (verifiedUsers.length > 0) {
          const verifiedUser = verifiedUsers[0];
          const { accessToken, refreshToken } = await this.generateTokens(verifiedUser.id, verifiedUser.email);
          return { accessToken, refreshToken, user: this.mapToUserDto(verifiedUser) };
        }
        throw new UnauthorizedException('auth.errors.verificationFailed');
      }

      const user = users[0];

      // Check if already active
      if (user.status === UserStatus.ACTIVE) {
        this.logger.log(`User already verified: ${user.email}`);
        // Still return tokens for convenience
        const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);
        return {
          accessToken,
          refreshToken,
          user: this.mapToUserDto(user),
        };
      }

      // Mark email as verified and clear token
      await this.databaseService.query(
        `UPDATE users 
         SET email_verified = true, 
             status = $1,
             email_verification_token = NULL, 
             email_verification_expiry = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [UserStatus.ACTIVE, user.id]
      );

      this.logger.log(`Email verified successfully: ${user.email}`);

      // Send welcome email in user's locale
      try {
        await this.emailService.sendWelcomeEmail(user.email, user.first_name, user.locale as SupportedLocale);
      } catch (error) {
        this.logger.error(`Failed to send welcome email to ${user.email}`, error);
        // Don't fail verification if welcome email fails
      }

      // Generate tokens
      const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

      // Update user object with verified status
      user.email_verified = true;

      return {
        accessToken,
        refreshToken,
        user: this.mapToUserDto(user),
      };
    } catch (error) {
      if (error instanceof HttpException) {throw error;}
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('auth.verification.expired');
      }
      this.logger.error('Email verification failed', error);
      throw new UnauthorizedException('auth.verification.invalid');
    }
  }

  /**
   * Resend verification email
   */
  async resendVerification(email: string, locale?: string): Promise<void> {
    this.logger.log(`Resending verification email to: ${email}`);

    // Find user
    const users = await this.databaseService.query<UserEntity>('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [
      email,
    ]);

    if (users.length === 0) {
      throw new UnauthorizedException('auth.errors.userNotFound');
    }

    const user = users[0];

    // Check if already active
    if (user.status === UserStatus.ACTIVE) {
      throw new ConflictException('auth.verification.alreadyVerified');
    }

    // Generate new verification token
    const verificationToken = this.jwtService.sign(
      { email: user.email, type: 'email_verification' },
      { expiresIn: '30m' }
    );

    const verificationExpiry = new Date(Date.now() + 30 * 60 * 1000);

    // Update token in database
    await this.databaseService.query(
      `UPDATE users 
       SET email_verification_token = $1, 
           email_verification_expiry = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [verificationToken, verificationExpiry.toISOString(), user.id]
    );

    // Send verification email in user's locale (prefer DB locale, fallback to request locale, then default)
    const userLocale = locale || user.locale || DEFAULT_LOCALE;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verificationUrl = `${frontendUrl}/${userLocale}/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

    await this.emailService.sendVerificationEmail(user.email, user.first_name, verificationUrl, userLocale);
    this.logger.log(`Verification email resent to: ${user.email}`);
  }

  /**
   * Login user
   * Checks email verification before allowing login
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    this.logger.log(`Login attempt for email: ${request.email}`);

    // Find user by email (with connected accounts check in single query)
    const users = await this.databaseService.query<UserEntity>(
      `SELECT u.*, EXISTS(SELECT 1 FROM ebay_accounts WHERE user_id = u.id) as has_connected_accounts
       FROM users u WHERE LOWER(u.email) = LOWER($1)`,
      [request.email]
    );

    if (users.length === 0) {
      throw new UnauthorizedException('auth.errors.invalidCredentials');
    }

    const user = users[0];

    // Google-only users (no local password) cannot log in with a password.
    if (!user.password_hash) {
      throw new UnauthorizedException('auth.errors.invalidCredentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(request.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('auth.errors.invalidCredentials');
    }

    // Check user status
    if (user.status === UserStatus.PENDING) {
      this.logger.warn(`Login attempt with pending email: ${user.email}`);
      throw new UnauthorizedException('auth.errors.emailNotVerified');
    }

    if (user.status === UserStatus.BANNED) {
      this.logger.warn(`Login attempt for banned user: ${user.email}`);
      throw new UnauthorizedException('auth.errors.banned');
    }

    if (user.status !== UserStatus.ACTIVE) {
      this.logger.warn(`Login attempt with invalid status: ${user.status} for ${user.email}`);
      throw new UnauthorizedException('auth.errors.inactive');
    }

    this.logger.log(`User logged in successfully: ${user.id}`);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

    return {
      accessToken,
      refreshToken,
      user: this.mapToUserDto(user),
    };
  }

  /**
   * Get current user
   */
  async getMe(userId: string): Promise<UserDto> {
    const users = await this.databaseService.query<UserEntity>(
      `SELECT u.*, EXISTS(SELECT 1 FROM ebay_accounts WHERE user_id = u.id) as has_connected_accounts
       FROM users u WHERE u.id = $1`,
      [userId]
    );

    if (users.length === 0) {
      throw new UnauthorizedException('auth.errors.userNotFound');
    }

    return this.mapToUserDto(users[0]);
  }

  /**
   * Issue access+refresh tokens + UserDto for an already-authenticated user id.
   * Used by password login/verify and by GoogleAuthService after link/create.
   */
  async issueSession(userId: string): Promise<AuthResponse> {
    const users = await this.databaseService.query<UserEntity & { has_connected_accounts?: boolean }>(
      `SELECT u.*, EXISTS(SELECT 1 FROM ebay_accounts WHERE user_id = u.id) as has_connected_accounts
       FROM users u WHERE u.id = $1`,
      [userId]
    );

    if (users.length === 0) {
      throw new UnauthorizedException('auth.errors.userNotFound');
    }

    const user = users[0];

    if (user.status === UserStatus.BANNED) {
      throw new UnauthorizedException('auth.errors.banned');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('auth.errors.inactive');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

    return {
      accessToken,
      refreshToken,
      user: this.mapToUserDto(user),
    };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean }> {
    this.logger.log(`Change password attempt for user: ${userId}`);

    const users = await this.databaseService.query<UserEntity>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      throw new UnauthorizedException('auth.errors.userNotFound');
    }

    // Google-only users have no local password to verify against.
    if (!users[0].password_hash) {
      throw new UnauthorizedException('auth.errors.wrongPassword');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('auth.errors.wrongPassword');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('auth.errors.samePassword');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.databaseService.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    this.logger.log(`Password changed successfully for user: ${userId}`);
    return { success: true };
  }

  /**
   * Deactivate (soft-delete) user account
   * Sets status to INACTIVE — user can no longer log in.
   * Referential integrity preserved (orders, listings kept).
   */
  async deactivateAccount(userId: string): Promise<{ success: boolean }> {
    this.logger.log(`Deactivating account: ${userId}`);

    await this.databaseService.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [UserStatus.INACTIVE, userId]
    );

    this.logger.log(`Account deactivated: ${userId}`);
    return { success: true };
  }

  /**
   * Refresh tokens using a valid refresh token
   */
  async refreshToken(token: string): Promise<AuthResponse> {
    this.logger.log('Attempting to refresh tokens');

    try {
      // Verify refresh token
      const payload = this.jwtService.verify<JwtPayload>(token);
      this.logger.debug(`Refresh token verified for user: ${payload.sub}`);

      // Find user
      const users = await this.databaseService.query<UserEntity>('SELECT * FROM users WHERE id = $1', [payload.sub]);

      if (users.length === 0) {
        throw new UnauthorizedException('auth.errors.userNotFound');
      }

      const user = users[0];

      // Check status
      if (user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('auth.errors.invalidStatus');
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = await this.generateTokens(user.id, user.email);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: this.mapToUserDto(user),
      };
    } catch (error) {
      this.logger.error('Token refresh failed', error);
      throw new UnauthorizedException('auth.errors.invalidToken');
    }
  }

  /**
   * Generate JWT tokens
   */
  private generateTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
    };

    return Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: AUTH_CONSTANTS.JWT_ACCESS_TOKEN_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: AUTH_CONSTANTS.JWT_REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]).then(([accessToken, refreshToken]) => ({ accessToken, refreshToken }));
  }

  /**
   * Map user entity to DTO (with N+1 fix - single query instead of two)
   */
  private mapToUserDto(user: UserEntity & { has_connected_accounts?: boolean }): UserDto {
    return {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      emailVerified: user.email_verified,
      status: user.status,
      locale: (user.locale as SupportedLocale) || DEFAULT_LOCALE,
      hasConnectedAccounts: user.has_connected_accounts ?? false,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };
  }
}
