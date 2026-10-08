import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { User } from '../../models/User.entity';
import { RefreshToken } from '../../models/RefreshToken.entity';
import { PasswordUtil } from '../../utils/password';

export interface RegisterDto {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<User, 'password' | 'refreshTokens'>;
  access_token: string;
  refresh_token: string;
}

@Injectable()
export class AuthenticationService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await PasswordUtil.hash(dto.password);

    const user = await this.usersService.create({
      email: dto.email.toLowerCase().trim(),
      password: hashedPassword,
      name: dto.name.trim(),
      role: dto.role || 'user',
    });

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token);

    return {
      user: this.sanitizeUser(user),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.usersService.findByEmail(
      dto.email.toLowerCase().trim(),
      true,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await PasswordUtil.compare(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account has been deactivated');
    }

    const tokens = await this.generateTokens(user);
    await this.saveRefreshToken(user.id, tokens.refresh_token);

    return {
      user: this.sanitizeUser(user),
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_SECRET') ||
        'super_secret_jwt_access_key_change_in_production_crm_2026',
      expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'super_secret_jwt_refresh_key_change_in_production_crm_2026',
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  private async saveRefreshToken(
    userId: string,
    token: string,
  ): Promise<RefreshToken> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    const refreshToken = this.refreshTokenRepository.create({
      token,
      userId,
      expiresAt,
      isRevoked: false,
    });

    return this.refreshTokenRepository.save(refreshToken);
  }

  private sanitizeUser(user: User): Omit<User, 'password' | 'refreshTokens'> {
    const { password, refreshTokens, ...result } = user as any;
    return result;
  }
}
