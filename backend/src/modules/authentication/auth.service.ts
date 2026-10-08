import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service.js';
import { RefreshToken } from '../../entities/refresh-token.entity.js';
import { User } from '../../entities/user.entity.js';
import { PasswordUtil } from '../../utils/password.util.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtAccessExpiresIn: string;
  private readonly jwtRefreshSecret: string;
  private readonly jwtRefreshExpiresIn: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'super-secure-jwt-crm-secret-key-32-chars-long-minimum-prod';
    this.jwtAccessExpiresIn =
      this.configService.get<string>('JWT_EXPIRES_IN') || '15m';
    this.jwtRefreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'super-secure-jwt-refresh-secret-key-32-chars-long-prod';
    this.jwtRefreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d';
  }

  /**
   * Helper method to strip sensitive credentials from user entity before returning.
   */
  sanitizeUser(user: User): Omit<User, 'password' | 'refreshTokens'> {
    const { password, refreshTokens, ...result } = user as any;
    return result;
  }

  /**
   * Generates Access Token and Refresh Token pair for a user.
   */
  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const access_token = await this.jwtService.signAsync(payload, {
      secret: this.jwtSecret,
      expiresIn: this.jwtAccessExpiresIn as any,
    });

    const refresh_token = await this.jwtService.signAsync(
      { sub: user.id, tokenType: 'refresh' },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: this.jwtRefreshExpiresIn as any,
      },
    );

    // Persist refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

    await this.refreshTokenRepository.save({
      token: refresh_token,
      userId: user.id,
      expiresAt,
      isRevoked: false,
    });

    return { access_token, refresh_token };
  }

  /**
   * Register a new user with email, hashed password, and name.
   */
  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('A user with this email address already exists.');
    }

    const hashedPassword = await PasswordUtil.hash(dto.password);
    const createdUser = await this.usersService.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
    });

    const tokens = await this.generateTokens(createdUser);

    return {
      message: 'User registered successfully',
      user: this.sanitizeUser(createdUser),
      ...tokens,
    };
  }

  /**
   * Login user with email & password, returning access and refresh tokens.
   */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email, true);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been deactivated');
    }

    const isMatch = await PasswordUtil.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.generateTokens(user);

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  /**
   * Refresh access token using a valid, non-revoked refresh token.
   */
  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    // Verify cryptographic signature of the refresh token
    let decodedPayload: any;
    try {
      decodedPayload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.jwtRefreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Check token existence and revocation status in the database
    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.isExpired) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }

    const user = await this.usersService.findById(decodedPayload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account no longer active');
    }

    // Issue a new access token
    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      {
        secret: this.jwtSecret,
        expiresIn: this.jwtAccessExpiresIn as any,
      },
    );

    return {
      access_token: newAccessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Logout user by invalidating/revoking their refresh token in the database.
   */
  async logout(refreshToken: string) {
    if (!refreshToken) {
      return { message: 'Logged out' };
    }

    const storedToken = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken },
    });

    if (storedToken) {
      storedToken.isRevoked = true;
      await this.refreshTokenRepository.save(storedToken);
    }

    return { message: 'Logged out successfully' };
  }
}
