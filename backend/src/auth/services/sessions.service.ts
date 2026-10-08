import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Session } from '../entities/session.entity.js';
import { CryptoUtil } from '../utils/crypto.util.js';

export interface CreateSessionOptions {
  userId: number;
  refreshToken: string;
  rememberMe?: boolean;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}

@Injectable()
export class SessionsService {
  constructor(
    @InjectRepository(Session)
    private readonly sessionRepo: Repository<Session>,
    private readonly configService: ConfigService,
  ) {}

  private getExpiration(rememberMe: boolean): Date {
    const normalDays =
      parseInt(
        this.configService.get<string>('REFRESH_TOKEN_EXPIRATION_DAYS') || '1',
        10,
      ) || 1;
    const rememberDays =
      parseInt(
        this.configService.get<string>(
          'REFRESH_TOKEN_REMEMBER_EXPIRATION_DAYS',
        ) || '30',
        10,
      ) || 30;

    const days = rememberMe ? rememberDays : normalDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + days);
    return expiresAt;
  }

  async createSession(options: CreateSessionOptions): Promise<Session> {
    const isRememberMe = !!options.rememberMe;
    const expiresAt = this.getExpiration(isRememberMe);
    const refreshTokenHash = CryptoUtil.hashToken(options.refreshToken);

    const session = this.sessionRepo.create({
      userId: options.userId,
      refreshTokenHash,
      deviceName: options.deviceName ?? this.detectDevice(options.userAgent),
      userAgent: options.userAgent ?? null,
      ipAddress: options.ipAddress ?? null,
      isRememberMe,
      lastUsedAt: new Date(),
      expiresAt,
      revokedAt: null,
    });

    return await this.sessionRepo.save(session);
  }

  async validateSession(
    sessionId: string,
    rawRefreshToken: string,
  ): Promise<Session> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: { user: true },
    });

    if (!session) {
      throw new UnauthorizedException('Session not found');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (new Date() > new Date(session.expiresAt)) {
      throw new UnauthorizedException('Session has expired');
    }

    const hashedInput = CryptoUtil.hashToken(rawRefreshToken);
    if (hashedInput !== session.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!session.user || !session.user.isActive) {
      throw new UnauthorizedException('User account is inactive or disabled');
    }

    return session;
  }

  async updateSessionActivity(
    sessionId: string,
    newRefreshToken?: string,
  ): Promise<Session> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    session.lastUsedAt = new Date();
    if (newRefreshToken) {
      session.refreshTokenHash = CryptoUtil.hashToken(newRefreshToken);
      session.expiresAt = this.getExpiration(session.isRememberMe);
    }

    return await this.sessionRepo.save(session);
  }

  async getUserSessions(userId: number, currentSessionId?: string) {
    const sessions = await this.sessionRepo.find({
      where: { userId },
      order: { lastUsedAt: 'DESC' },
    });

    return sessions.map((s) => ({
      id: s.id,
      deviceName: s.deviceName,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      isRememberMe: s.isRememberMe,
      lastUsedAt: s.lastUsedAt,
      expiresAt: s.expiresAt,
      isCurrent: s.id === currentSessionId,
      isRevoked: !!s.revokedAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession(sessionId: string, userId: number): Promise<void> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (!session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionRepo.save(session);
    }
  }

  async revokeOtherSessions(
    userId: number,
    currentSessionId: string,
  ): Promise<number> {
    const activeOthers = await this.sessionRepo.find({
      where: {
        userId,
        id: Not(currentSessionId),
        revokedAt: IsNull(),
      },
    });

    const now = new Date();
    for (const session of activeOthers) {
      session.revokedAt = now;
    }

    if (activeOthers.length > 0) {
      await this.sessionRepo.save(activeOthers);
    }

    return activeOthers.length;
  }

  async revokeAllSessions(userId: number): Promise<number> {
    const activeSessions = await this.sessionRepo.find({
      where: {
        userId,
        revokedAt: IsNull(),
      },
    });

    const now = new Date();
    for (const session of activeSessions) {
      session.revokedAt = now;
    }

    if (activeSessions.length > 0) {
      await this.sessionRepo.save(activeSessions);
    }

    return activeSessions.length;
  }

  private detectDevice(userAgent?: string | null): string {
    if (!userAgent) return 'Web Browser';
    if (/mobile/i.test(userAgent)) return 'Mobile App / Browser';
    if (/macintosh|mac os x/i.test(userAgent)) return 'Mac';
    if (/windows/i.test(userAgent)) return 'Windows PC';
    if (/linux/i.test(userAgent)) return 'Linux';
    return 'Web Browser';
  }
}
