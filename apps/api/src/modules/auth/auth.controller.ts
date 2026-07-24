import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthResponse, GenericSuccessResponse, RegistrationResponse, UserDto } from '@repo/shared';
import type { Request as ExpressRequest, Response } from 'express';

import { clearRefreshTokenCookie, REFRESH_COOKIE_NAME, setRefreshTokenCookie } from './auth-cookies';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { GoogleAuthService } from './google-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

type CookieRequest = ExpressRequest & { cookies?: Record<string, string> };

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly googleAuthService: GoogleAuthService
  ) {}

  /** Issue tokens: refresh goes in HttpOnly cookie; body only has accessToken + user. */
  private attachSession(res: Response, auth: AuthResponse): Omit<AuthResponse, 'refreshToken'> {
    if (auth.refreshToken) {
      setRefreshTokenCookie(res, auth.refreshToken);
    }
    return {
      accessToken: auth.accessToken,
      user: auth.user,
    };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new user',
    description: 'Create a new user account and send verification email',
  })
  @ApiCreatedResponse({ description: 'Registration successful, verification email sent' })
  @ApiBadRequestResponse({ description: 'Invalid input data or email already exists' })
  async register(@Body() body: RegisterRequestDto): Promise<RegistrationResponse> {
    return this.authService.register(body);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify email address',
    description: 'Verify user email with token and receive authentication tokens',
  })
  @ApiOkResponse({ description: 'Email verified successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired verification token' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async verifyEmail(
    @Body() body: VerifyEmailDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<Omit<AuthResponse, 'refreshToken'>> {
    const auth = await this.authService.verifyEmail(body.token);
    return this.attachSession(res, auth);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Resend email verification link to user',
  })
  @ApiOkResponse({ description: 'Verification email resent successfully' })
  @ApiUnauthorizedResponse({ description: 'User not found or email already verified' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async resendVerification(@Body() body: ResendVerificationDto): Promise<void> {
    return this.authService.resendVerification(body.email, body.locale);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate user; access token in body, refresh token in HttpOnly cookie',
  })
  @ApiOkResponse({ description: 'User logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password, or email not verified' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async login(
    @Body() body: LoginRequestDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<Omit<AuthResponse, 'refreshToken'>> {
    const auth = await this.authService.login(body);
    return this.attachSession(res, auth);
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in or register with Google',
    description:
      'Exchanges a GIS popup auth code for a session. Never merges into an existing password account.',
  })
  @ApiOkResponse({ description: 'Authenticated; access token in body, refresh in HttpOnly cookie' })
  @ApiUnauthorizedResponse({ description: 'Invalid code, unverified email, or inactive/banned user' })
  @ApiBadRequestResponse({ description: 'Invalid input' })
  async google(
    @Body() body: GoogleAuthDto,
    @Res({ passthrough: true }) res: Response
  ): Promise<Omit<AuthResponse, 'refreshToken'>> {
    const auth = await this.googleAuthService.authenticate(body.code, body.locale);
    return this.attachSession(res, auth);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh authentication tokens',
    description: 'Uses HttpOnly refresh cookie (preferred) or body.refreshToken (legacy)',
  })
  @ApiOkResponse({ description: 'Tokens refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: CookieRequest,
    @Body() body: { refreshToken?: string },
    @Res({ passthrough: true }) res: Response
  ): Promise<Omit<AuthResponse, 'refreshToken'>> {
    // `req.cookies` is `any` from cookie-parser's type augment — narrow explicitly.
    const rawCookie: unknown = req.cookies?.[REFRESH_COOKIE_NAME];
    const cookieToken = typeof rawCookie === 'string' ? rawCookie : '';
    const token = cookieToken || body?.refreshToken;
    if (!token) {
      throw new UnauthorizedException('auth.errors.invalidToken');
    }
    const auth = await this.authService.refreshToken(token);
    return this.attachSession(res, auth);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Clears the HttpOnly refresh cookie',
  })
  @ApiOkResponse({ description: 'Logged out' })
  logout(@Res({ passthrough: true }) res: Response): GenericSuccessResponse {
    clearRefreshTokenCookie(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user',
    description: 'Retrieve authenticated user information',
  })
  @ApiOkResponse({ description: 'User information retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token' })
  async getMe(@Request() req: { user: { sub: string } }): Promise<UserDto> {
    const userId = req.user.sub;
    return this.authService.getMe(userId);
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description: 'Change password for the authenticated user. Requires current password verification.',
  })
  @ApiOkResponse({ description: 'Password changed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid current password or not authenticated' })
  @ApiBadRequestResponse({ description: 'New password is same as current, or invalid input' })
  async changePassword(
    @Request() req: { user: { sub: string } },
    @Body() body: ChangePasswordDto
  ): Promise<GenericSuccessResponse> {
    return this.authService.changePassword(req.user.sub, body.currentPassword, body.newPassword);
  }

  @Post('deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate account',
    description: 'Soft-deletes the authenticated user account. User can no longer sign in. Data preserved.',
  })
  @ApiOkResponse({ description: 'Account deactivated successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async deactivate(
    @Request() req: { user: { sub: string } },
    @Res({ passthrough: true }) res: Response
  ): Promise<GenericSuccessResponse> {
    const result = await this.authService.deactivateAccount(req.user.sub);
    clearRefreshTokenCookie(res);
    return result;
  }
}
