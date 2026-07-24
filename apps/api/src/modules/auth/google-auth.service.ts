import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OAuthProvider,
  UserStatus,
  type AuthResponse,
  type SupportedLocale,
} from '@repo/shared';
import { OAuth2Client } from 'google-auth-library';

import { DatabaseService } from '../../common/database/database.service';

import { AuthService } from './auth.service';
import {
  decideGoogleLink,
  type GoogleBlockReason,
  type GoogleIdPayload,
  type GoogleLinkLookup,
} from './google-link-decision';

interface OauthRow {
  user_id: string;
  status: UserStatus;
}

interface EmailOwnerRow {
  id: string;
}

interface InsertedUserRow {
  id: string;
}

interface GoogleCreateProfile {
  providerUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: SupportedLocale;
  avatarUrl?: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim() || undefined;
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async authenticate(code: string, locale?: SupportedLocale): Promise<AuthResponse> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('auth.errors.googleNotConfigured');
    }

    const payload = await this.exchangeAndVerify(code);
    const lookup = await this.loadLookup(payload.sub, payload.email);
    const decision = decideGoogleLink(payload, lookup, locale);

    if (decision.action === 'block') {
      this.throwForBlock(decision.reason);
    }

    if (decision.action === 'login') {
      this.logger.log(`Google login for user ${decision.userId}`);
      return this.authService.issueSession(decision.userId);
    }

    // create
    const userId = await this.createGoogleUser(decision.profile);
    this.logger.log(`Google user created ${userId}`);
    return this.authService.issueSession(userId);
  }

  private async exchangeAndVerify(code: string): Promise<GoogleIdPayload> {
    try {
      const client = new OAuth2Client({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: 'postmessage',
      });

      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new UnauthorizedException('auth.errors.googleCodeError');
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      const p = ticket.getPayload();
      if (!p?.sub) {
        throw new UnauthorizedException('auth.errors.googleCodeError');
      }

      return {
        sub: p.sub,
        email: p.email,
        emailVerified: p.email_verified === true,
        givenName: p.given_name,
        familyName: p.family_name,
        name: p.name,
        picture: p.picture,
        locale: p.locale,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn('Google code exchange/verify failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new UnauthorizedException('auth.errors.googleCodeError');
    }
  }

  private async loadLookup(sub: string, email: string | undefined): Promise<GoogleLinkLookup> {
    const oauthRows = await this.databaseService.query<OauthRow>(
      `SELECT o.user_id, u.status
       FROM user_oauth_accounts o
       INNER JOIN users u ON u.id = o.user_id
       WHERE o.provider = $1 AND o.provider_user_id = $2
       LIMIT 1`,
      [OAuthProvider.GOOGLE, sub]
    );

    let emailOwnerUserId: string | null = null;
    if (email) {
      const emailRows = await this.databaseService.query<EmailOwnerRow>(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      emailOwnerUserId = emailRows[0]?.id ?? null;
    }

    return {
      oauthUserId: oauthRows[0]?.user_id ?? null,
      oauthUserStatus: oauthRows[0]?.status ?? null,
      emailOwnerUserId,
    };
  }

  private async createGoogleUser(profile: GoogleCreateProfile): Promise<string> {
    return this.databaseService.transaction(async (client) => {
      const userResult = await client.query<InsertedUserRow>(
        `INSERT INTO users (
           first_name, last_name, email, password_hash,
           email_verified, status, locale, avatar_url
         ) VALUES ($1, $2, $3, NULL, TRUE, $4, $5, $6)
         RETURNING id`,
        [
          profile.firstName,
          profile.lastName,
          profile.email,
          UserStatus.ACTIVE,
          profile.locale,
          profile.avatarUrl ?? null,
        ]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO user_oauth_accounts (user_id, provider, provider_user_id, provider_email)
         VALUES ($1, $2, $3, $4)`,
        [userId, OAuthProvider.GOOGLE, profile.providerUserId, profile.email]
      );

      return userId;
    });
  }

  private throwForBlock(reason: GoogleBlockReason): never {
    switch (reason) {
      case 'emailExistsPassword':
        throw new ConflictException('auth.errors.emailExistsPassword');
      case 'googleEmailNotVerified':
        throw new UnauthorizedException('auth.errors.googleEmailNotVerified');
      case 'banned':
        throw new UnauthorizedException('auth.errors.banned');
      case 'inactive':
        throw new UnauthorizedException('auth.errors.inactive');
    }
  }
}
