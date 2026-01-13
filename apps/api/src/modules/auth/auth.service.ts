import { ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, JwtPayload, LoginRequest, RegisterRequest, UserDto } from '@repo/shared';
import { AUTH_CONSTANTS } from '@repo/shared';
import * as bcrypt from 'bcrypt';

/**
 * In-memory user storage (replace with real database in production)
 */
interface UserEntity {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly users: Map<string, UserEntity> = new Map();
  private readonly emailIndex: Map<string, string> = new Map(); // email -> userId

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Register a new user
   */
  async register(request: RegisterRequest): Promise<AuthResponse> {
    this.logger.log(`Registering user: ${request.email}`);

    // Check if email already exists
    if (this.emailIndex.has(request.email.toLowerCase())) {
      throw new ConflictException('auth.errors.emailExists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(request.password, 10);

    // Create user
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date();

    const user: UserEntity = {
      id: userId,
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      passwordHash,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };

    this.users.set(userId, user);
    this.emailIndex.set(request.email.toLowerCase(), userId);

    this.logger.log(`User registered successfully: ${userId}`);

    // Generate tokens
    const { accessToken, refreshToken } = await this.generateTokens(userId, request.email);

    return {
      accessToken,
      refreshToken,
      user: this.mapToUserDto(user),
    };
  }

  /**
   * Login user
   */
  async login(request: LoginRequest): Promise<AuthResponse> {
    this.logger.log(`Login attempt for email: ${request.email}`);

    // Find user by email
    const userId = this.emailIndex.get(request.email.toLowerCase());
    if (!userId) {
      throw new UnauthorizedException('auth.errors.invalidCredentials');
    }

    const user = this.users.get(userId);
    if (!user) {
      throw new UnauthorizedException('auth.errors.invalidCredentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(request.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('auth.errors.invalidCredentials');
    }

    this.logger.log(`User logged in successfully: ${userId}`);

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
    const user = this.users.get(userId);
    if (!user) {
      throw new UnauthorizedException('auth.errors.userNotFound');
    }

    return this.mapToUserDto(user);
  }

  /**
   * Generate JWT tokens
   */
  private async generateTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: userId,
      email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: AUTH_CONSTANTS.JWT_ACCESS_TOKEN_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: AUTH_CONSTANTS.JWT_REFRESH_TOKEN_EXPIRES_IN,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Map user entity to DTO
   */
  private mapToUserDto(user: UserEntity): UserDto {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
