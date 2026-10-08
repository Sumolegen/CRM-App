import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

import { Customer } from './customers/customer.entity.js';
import { CustomersModule } from './customers/customers.module.js';

import { User } from './auth/entities/user.entity.js';
import { Session } from './auth/entities/session.entity.js';
import { OAuthAccount } from './auth/entities/oauth-account.entity.js';
import { VerificationToken } from './auth/entities/verification-token.entity.js';
import { LoginHistory } from './auth/entities/login-history.entity.js';
import { AuthModule } from './auth/auth.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 120, // 120 requests per minute
      },
    ]),
    TypeOrmModule.forRoot({
      type: 'better-sqlite3',
      database: 'database.sqlite',
      entities: [
        Customer,
        User,
        Session,
        OAuthAccount,
        VerificationToken,
        LoginHistory,
      ],
      synchronize: true, // Automatically creates tables according to entities in development
      autoLoadEntities: true,
      logging: false,
    }),
    CustomersModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
