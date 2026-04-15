import { Body, Controller, Get, HttpCode, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthResponse, RegistrationResponse, UserDto } from '@repo/shared';

import { AuthService } from './auth.service';
import { LoginRequestDto } from './dto/login-request.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<AuthResponse> {
    return this.authService.verifyEmail(body.token);
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
    return this.authService.resendVerification(body.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login user',
    description: 'Authenticate user and receive access tokens (requires verified email)',
  })
  @ApiOkResponse({ description: 'User logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password, or email not verified' })
  @ApiBadRequestResponse({ description: 'Invalid input data' })
  async login(@Body() body: LoginRequestDto): Promise<AuthResponse> {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh authentication tokens',
    description: 'Get new access and refresh tokens using a valid refresh token',
  })
  @ApiOkResponse({ description: 'Tokens refreshed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(@Body() body: { refreshToken: string }): Promise<AuthResponse> {
    return this.authService.refreshToken(body.refreshToken);
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
}
