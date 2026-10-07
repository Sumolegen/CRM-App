import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { User } from './entities/user.entity.js';
import { Session } from './entities/session.entity.js';
import { OAuthAccount } from './entities/oauth-account.entity.js';
import { VerificationToken } from './entities/verification-token.entity.js';
import { LoginHistory } from './entities/login-history.entity.js';

import { AuthController } from './auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { SessionsService } from './services/sessions.service.js';
import { OAuthService } from './services/oauth.service.js';
import { EmailService } from './services/email.service.js';
import { LoginHistoryService } from './services/login-history.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ||
          'crm-super-secret-default-key-change-in-production-min32chars',
        signOptions: {
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRATION') ||
            '15m') as any,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      Session,
      OAuthAccount,
      VerificationToken,
      LoginHistory,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    OAuthService,
    EmailService,
    LoginHistoryService,
    JwtStrategy,
    JwtAuthGuard,
  ],
  exports: [
    AuthService,
    SessionsService,
    JwtAuthGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
