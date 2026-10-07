import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginHistory, AuthEvent } from '../entities/login-history.entity.js';

export interface LogAuthEventParams {
  userId?: number | null;
  email: string;
  event: AuthEvent | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  device?: string | null;
  provider?: string | null;
}

@Injectable()
export class LoginHistoryService {
  constructor(
    @InjectRepository(LoginHistory)
    private readonly loginHistoryRepo: Repository<LoginHistory>,
  ) {}

  async logEvent(params: LogAuthEventParams): Promise<LoginHistory> {
    const entry = this.loginHistoryRepo.create({
      userId: params.userId ?? null,
      email: params.email,
      event: params.event,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      device: params.device ?? this.parseDevice(params.userAgent),
      provider: params.provider ?? 'local',
    });
    return await this.loginHistoryRepo.save(entry);
  }

  async getUserHistory(userId: number, limit = 20): Promise<LoginHistory[]> {
    return await this.loginHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  private parseDevice(userAgent?: string | null): string {
    if (!userAgent) return 'Unknown Device';
    if (/mobile/i.test(userAgent)) return 'Mobile Device';
    if (/tablet/i.test(userAgent)) return 'Tablet Device';
    if (/macintosh|mac os x/i.test(userAgent)) return 'Mac';
    if (/windows/i.test(userAgent)) return 'Windows PC';
    if (/linux/i.test(userAgent)) return 'Linux PC';
    return 'Desktop Browser';
  }
}
