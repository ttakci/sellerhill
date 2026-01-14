import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from '../../modules/auth/auth.service';

/**
 * Email Verified Guard
 * Ensures that the user's email is verified before accessing protected routes
 * Must be used AFTER JwtAuthGuard
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('auth.errors.unauthorized');
    }

    // Get user from database to check email verification status
    const userDto = await this.authService.getMe(user.sub);

    if (!userDto.emailVerified) {
      throw new ForbiddenException('auth.errors.emailNotVerified');
    }

    return true;
  }
}
