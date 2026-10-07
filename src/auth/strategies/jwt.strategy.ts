import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';

import { User } from '../entities/user.entity.js';
import { Session } from '../entities/session.entity.js';
import { JwtPayload } from '../services/auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Extract from HttpOnly cookie
        (request: Request) => {
          if (request && request.cookies) {
            return request.cookies['access_token'] || null;
          }
          return null;
        },
        // 2. Extract from standard Authorization: Bearer <token> header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') ||
        'crm-super-secret-default-key-change-in-production-min32chars',
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const user = await this.userRepo.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or inactive');
    }

    // Validate active session
    if (payload.sessionId) {
      const session = await this.sessionRepo.findOne({
        where: { id: payload.sessionId },
      });

      if (!session || session.revokedAt || new Date() > new Date(session.expiresAt)) {
        throw new UnauthorizedException('Session has expired or was revoked');
      }

      // Attach session ID to request
      (req as any).sessionId = payload.sessionId;
    }

    // Attach user to req.user
    return {
      ...user,
      sessionId: payload.sessionId,
    };
  }
}
