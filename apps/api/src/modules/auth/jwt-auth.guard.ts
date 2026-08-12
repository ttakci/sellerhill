import { ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isOperatorRole, type AuthenticatedRequest } from '@repo/shared';
import { firstValueFrom, isObservable } from 'rxjs';

import { OPERATOR_SURFACE_KEY } from './operator-surface.decorator';

/**
 * Authentication + account-scope separation.
 *
 * Authentication is Passport's; the second half is the rule that a SellerHill
 * account is either a seller account or a staff account, never both. Staff
 * (ADMIN / SUPPORT) are refused on every authenticated route that is not
 * explicitly marked `@OperatorSurface()`, so the seller app is unreachable
 * with an operator token even if a link, a bookmark or a stale bundle asks
 * for it.
 *
 * Customers are unaffected here — they are kept out of operator surfaces by
 * `RolesGuard` + `@Roles(...)` on those controllers.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const authHeader = request.headers['authorization'];
    this.logger.debug(`JwtAuthGuard - Authorization header present: ${!!authHeader}`);

    const result = super.canActivate(context);
    const authenticated = isObservable(result) ? await firstValueFrom(result) : await result;
    if (!authenticated) {
      return false;
    }

    this.assertAccountScope(context);
    return true;
  }

  /** Staff accounts may only reach surfaces marked `@OperatorSurface()`. */
  private assertAccountScope(context: ExecutionContext): void {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!isOperatorRole(user?.role)) {
      return;
    }
    const isOperatorSurface = this.reflector.getAllAndOverride<boolean>(OPERATOR_SURFACE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!isOperatorSurface) {
      throw new ForbiddenException('auth.errors.customerAreaForbidden');
    }
  }
}
