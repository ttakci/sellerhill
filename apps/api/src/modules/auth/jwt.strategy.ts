import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { JwtPayload } from '@repo/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AuthSessionService } from './auth-session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly configService: ConfigService, private readonly sessions: AuthSessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
    });
    this.logger.debug('JwtStrategy initialized with dynamic secret');
  }

  validate(payload: JwtPayload): Promise<JwtPayload> {
    this.logger.debug(`Validating JWT for user: ${payload.sub}`);
    return this.sessions.validateAccess(payload);
  }
}
