import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_CONSTANTS } from '@repo/shared';

import { DatabaseModule } from '../../common/database/database.module';
import { BillingModule } from '../billing/billing.module';
import { EmailModule } from '../email/email.module';

import { AuthSessionRepository } from './auth-session.repository';
import { AuthSessionService } from './auth-session.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PrivilegedSessionGuard } from './privileged-session.guard';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [
    DatabaseModule,
    BillingModule,
    EmailModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
        signOptions: {
          expiresIn: AUTH_CONSTANTS.JWT_ACCESS_TOKEN_EXPIRES_IN,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthSessionRepository, AuthSessionService, GoogleAuthService, JwtStrategy, RolesGuard, PrivilegedSessionGuard],
  exports: [AuthService, AuthSessionService, RolesGuard, PrivilegedSessionGuard, JwtModule],
})
export class AuthModule {}
