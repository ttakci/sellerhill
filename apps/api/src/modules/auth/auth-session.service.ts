import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_CONSTANTS, UserStatus, type JwtPayload, type UserRole } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import { AuthSessionRepository, type SessionAuthority } from './auth-session.repository';

interface IssuedSession { accessToken: string; refreshToken: string }

@Injectable()
export class AuthSessionService {
  constructor(private readonly repository: AuthSessionRepository, private readonly database: DatabaseService, private readonly jwt: JwtService) {}

  async issue(user: { id: string; email: string; role: UserRole; sessionVersion: number }): Promise<IssuedSession> {
    const sessionId = randomUUID();
    const familyId = randomUUID();
    const secret = randomBytes(32).toString('base64url');
    await this.repository.create({ id: sessionId, familyId, userId: user.id, secretHash: this.hash(secret),
      sessionVersion: user.sessionVersion, expiresAt: this.expiry() });
    return this.tokens(user, sessionId, secret);
  }

  async rotate(opaqueToken: string): Promise<{ issued: IssuedSession; authority: SessionAuthority }> {
    const parsed = this.parse(opaqueToken);
    return this.database.transaction(async (client) => {
      const authority = await this.repository.lock(client, parsed.id);
      if (!authority || !this.matches(parsed.secret, authority.secretHash)) {throw new UnauthorizedException('auth.errors.invalidToken');}
      if (authority.revokedAt || authority.replacedBySessionId) {
        await this.repository.revokeFamily(client, authority.familyId, authority.sessionId);
        throw new UnauthorizedException('auth.errors.invalidToken');
      }
      if (authority.expiresAt.getTime() <= Date.now() || authority.sessionVersion !== authority.currentSessionVersion || authority.status !== UserStatus.ACTIVE) {
        await this.repository.revokeFamily(client, authority.familyId);
        throw new UnauthorizedException('auth.errors.invalidToken');
      }
      const id = randomUUID();
      const secret = randomBytes(32).toString('base64url');
      await this.repository.rotate(client, authority.sessionId, { id, familyId: authority.familyId, userId: authority.userId,
        secretHash: this.hash(secret), sessionVersion: authority.currentSessionVersion, expiresAt: this.expiry() });
      return { authority, issued: await this.tokens({ id: authority.userId, email: authority.email, role: authority.role,
        sessionVersion: authority.currentSessionVersion }, id, secret) };
    });
  }

  async validateAccess(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.sessionId || !Number.isInteger(payload.sessionVersion)) {throw new UnauthorizedException('auth.errors.invalidToken');}
    const authority = await this.repository.loadAuthority(payload.sessionId, payload.sub);
    if (!authority || authority.revokedAt || authority.expiresAt.getTime() <= Date.now() || authority.status !== UserStatus.ACTIVE ||
      authority.sessionVersion !== payload.sessionVersion || authority.currentSessionVersion !== payload.sessionVersion) {
      throw new UnauthorizedException('auth.errors.invalidToken');
    }
    return { ...payload, role: authority.role, email: authority.email };
  }

  revokeOpaque(token: string): Promise<void> {
    try { return this.repository.revokeSession(this.parse(token).id); } catch { return Promise.resolve(); }
  }
  revokeUser(userId: string): Promise<void> { return this.repository.revokeUser(userId); }

  private async tokens(user: { id: string; email: string; role: UserRole; sessionVersion: number }, sessionId: string, secret: string): Promise<IssuedSession> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role, sessionId, sessionVersion: user.sessionVersion };
    return { accessToken: await this.jwt.signAsync(payload, { expiresIn: AUTH_CONSTANTS.JWT_ACCESS_TOKEN_EXPIRES_IN }), refreshToken: `${sessionId}.${secret}` };
  }
  private expiry(): Date { return new Date(Date.now() + AUTH_CONSTANTS.REFRESH_SESSION_EXPIRES_IN_DAYS * 86400000); }
  private hash(secret: string): string { return createHash('sha256').update(secret).digest('hex'); }
  private matches(secret: string, expectedHex: string): boolean {
    const actual = Buffer.from(this.hash(secret), 'hex'); const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
  private parse(token: string): { id: string; secret: string } {
    const [id, secret, extra] = token.split('.');
    if (!id || !secret || extra) {throw new UnauthorizedException('auth.errors.invalidToken');}
    return { id, secret };
  }
}
