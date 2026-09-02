import { BadRequestException, ConflictException, HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AUTH_CONSTANTS,
  DEFAULT_LOCALE,
  UserRole,
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
import { BillingService } from '../billing/billing.service';
import { EmailService } from '../email/email.service';

import { AuthSessionService } from './auth-session.service';
import {
  generateResetToken,
  hashResetToken,
  isWithinResetCooldown,
  resetTokenExpiry,
} from './password-reset-helpers';

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
  role: UserRole;
  session_version: number;
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
    private readonly configService: ConfigService,
    private readonly sessions: AuthSessionService,
    private readonly billingService: BillingService,
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

    // Billing is downstream of account creation: a DB/settings outage here must
    // never turn a successful registration into a failed one. The repository's
    // trial_started_at guard keeps a retry from extending the one-time trial.
    await this.startSignupTrial(user.id, user.email);

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
   * Start the one-time trial without allowing billing availability to become an
   * account-registration dependency. Shared by password and Google create paths.
   */
  async startSignupTrial(userId: string, email: string): Promise<void> {
    try {
      await this.billingService.startTrialForUser(userId, email);
    } catch (error: unknown) {
      this.logger.warn(
        `Could not start signup trial for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
    await this.databaseService.transaction(async (client) => {
      await client.query(
        'UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = NOW() WHERE id = $2',
        [newHash, userId]
      );
      await client.query(
        'UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL',
        [userId]
      );
    });

    this.logger.log(`Password changed successfully for user: ${userId}`);
    return { success: true };
  }

  /**
   * Start a password reset: email a single-use link to the account, if one
   * exists and can accept one. Returns `void` and NEVER throws for a missing /
   * Google-only / non-active account or a failed send — the caller's response
   * must be identical in every case (no account enumeration).
   */
  async requestPasswordReset(email: string, locale?: string, ip?: string): Promise<void> {
    this.logger.log(`Password reset requested for: ${email}`);

    const users = await this.databaseService.query<UserEntity>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    const user = users[0];

    if (!user || !user.password_hash || user.status !== UserStatus.ACTIVE) {
      // Unknown email, Google-only account, or pending/inactive/banned: do
      // nothing, but look exactly like the success path to the caller.
      return;
    }

    // Per-account cooldown — a rapid second request keeps the first live link.
    const recent = await this.databaseService.query<{ created_at: Date }>(
      `SELECT created_at FROM password_reset_tokens
       WHERE user_id = $1 AND consumed_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [user.id]
    );
    if (
      isWithinResetCooldown(
        recent[0]?.created_at ?? null,
        AUTH_CONSTANTS.PASSWORD_RESET_COOLDOWN_SECONDS
      )
    ) {
      return;
    }

    const token = generateResetToken();
    const tokenHash = hashResetToken(token);
    const expiresAt = resetTokenExpiry(AUTH_CONSTANTS.PASSWORD_RESET_TOKEN_TTL_MINUTES);

    await this.databaseService.transaction(async (client) => {
      // Only one live token per user — requesting again retires the old ones.
      await client.query(
        `UPDATE password_reset_tokens SET consumed_at = NOW()
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.id]
      );
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
         VALUES ($1, $2, $3, $4)`,
        [user.id, tokenHash, expiresAt.toISOString(), ip ?? null]
      );
    });

    const userLocale = locale || user.locale || DEFAULT_LOCALE;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/${userLocale}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.emailService.sendPasswordResetEmail(user.email, user.first_name, resetUrl, userLocale);
      this.logger.log(`Password reset email sent to: ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${user.email}`, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Swallowed on purpose — the HTTP response must not vary on send failure.
    }
  }

  /**
   * Complete a password reset with the opaque token from the emailed link.
   * On success: sets the new hash, bumps `session_version`, revokes every
   * refresh session, and consumes this token plus any siblings. Issues NO
   * session — the client is sent to the login screen.
   */
  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean }> {
    const tokenHash = hashResetToken(token);

    const rows = await this.databaseService.query<{
      token_id: string;
      user_id: string;
      password_hash: string | null;
      status: UserStatus;
    }>(
      `SELECT prt.id AS token_id, u.id AS user_id, u.password_hash, u.status
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1 AND prt.consumed_at IS NULL AND prt.expires_at > NOW()`,
      [tokenHash]
    );

    const row = rows[0];
    if (!row || !row.password_hash || row.status !== UserStatus.ACTIVE) {
      // Same message for "not found", "expired", "already used" and
      // "account no longer eligible" — do not leak which.
      throw new UnauthorizedException('auth.errors.resetTokenInvalid');
    }

    const isSamePassword = await bcrypt.compare(newPassword, row.password_hash);
    if (isSamePassword) {
      throw new BadRequestException('auth.errors.samePassword');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.databaseService.transaction(async (client) => {
      await client.query(
        'UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = NOW() WHERE id = $2',
        [newHash, row.user_id]
      );
      await client.query(
        'UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL',
        [row.user_id]
      );
      await client.query(
        'UPDATE password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL',
        [row.user_id]
      );
    });

    this.logger.log(`Password reset completed for user: ${row.user_id}`);
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
    this.logger.log('Attempting to rotate refresh session');
    const { issued, authority } = await this.sessions.rotate(token);
    const users = await this.databaseService.query<UserEntity>(
      `SELECT u.*, EXISTS(SELECT 1 FROM ebay_accounts WHERE user_id = u.id) as has_connected_accounts
       FROM users u WHERE u.id = $1`,
      [authority.userId]
    );
    if (!users[0]) {throw new UnauthorizedException('auth.errors.invalidToken');}
    return { ...issued, user: this.mapToUserDto(users[0]) };
  }

  async logout(token: string): Promise<void> {
    await this.sessions.revokeOpaque(token);
  }

  private async generateTokens(userId: string, _email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const users = await this.databaseService.query<UserEntity>('SELECT * FROM users WHERE id = $1', [userId]);
    const user = users[0];
    if (!user) {throw new UnauthorizedException('auth.errors.userNotFound');}
    return this.sessions.issue({ id: user.id, email: user.email, role: user.role, sessionVersion: user.session_version });
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
      role: user.role,
      sessionVersion: user.session_version,
      locale: (user.locale as SupportedLocale) || DEFAULT_LOCALE,
      hasConnectedAccounts: user.has_connected_accounts ?? false,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
    };
  }
}
