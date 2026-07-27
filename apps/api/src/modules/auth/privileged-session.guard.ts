import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '@repo/shared';

import { AuthSessionService } from './auth-session.service';

@Injectable()
export class PrivilegedSessionGuard implements CanActivate {
  constructor(private readonly sessions: AuthSessionService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await this.sessions.validateAccess(request.user);
    return true;
  }
}
