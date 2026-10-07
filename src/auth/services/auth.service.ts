import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { User, UserRole } from '../entities/user.entity.js';
import {
  VerificationToken,
  TokenType,
} from '../entities/verification-token.entity.js';
import { AuthEvent } from '../entities/login-history.entity.js';

import { RegisterDto } from '../dto/register.dto.js';
import { LoginDto } from '../dto/login.dto.js';
import { ForgotPasswordDto } from '../dto/forgot-password.dto.js';
import { ResetPasswordDto } from '../dto/reset-password.dto.js';
import { ChangePasswordDto } from '../dto/change-password.dto.js';
import { UpdateProfileDto } from '../dto/update-profile.dto.js';

import { CryptoUtil } from '../utils/crypto.util.js';
import { SessionsService } from './sessions.service.js';
import { EmailService } from './email.service.js';
import { LoginHistoryService } from './login-history.service.js';

export interface ClientMetadata {
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceName?: string | null;
}

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  sessionId: string;
  workspaceId: string | null;
}

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_MINUTES = 15;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(VerificationToken)
    private readonly tokenRepo: Repository<VerificationToken>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessionsService: SessionsService,
    private readonly emailService: EmailService,
    private readonly loginHistoryService: LoginHistoryService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. REGISTRATION
  // ---------------------------------------------------------------------------
  async register(registerDto: RegisterDto, metadata?: ClientMetadata) {
    const email = CryptoUtil.normalizeEmail(registerDto.email);

    // Prevent duplicate accounts
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException(
        'An account with this email address already exists',
      );
    }

    const passwordHash = await CryptoUtil.hashPassword(registerDto.password);

    const user = this.userRepo.create({
      email,
      passwordHash,
      firstName: registerDto.firstName.trim(),
      lastName: registerDto.lastName.trim(),
      phoneNumber: registerDto.phoneNumber || null,
      workspaceId: registerDto.workspaceName
        ? `ws-${Date.now().toString(36)}`
        : null,
      role: UserRole.MEMBER,
      isEmailVerified: false,
      isActive: true,
      failedLoginAttempts: 0,
      lockoutUntil: null,
    });

    const savedUser = await this.userRepo.save(user);

    // Generate secure email verification token
    const rawVerificationToken = CryptoUtil.generateRandomToken(32);
    const tokenHash = CryptoUtil.hashToken(rawVerificationToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour expiration

    const verificationRecord = this.tokenRepo.create({
      userId: savedUser.id,
      tokenHash,
      type: TokenType.EMAIL_VERIFICATION,
      expiresAt,
      usedAt: null,
    });
    await this.tokenRepo.save(verificationRecord);

    // Trigger verification email dispatch
    await this.emailService.sendEmailVerification(
      savedUser.email,
      rawVerificationToken,
    );

    await this.loginHistoryService.logEvent({
      userId: savedUser.id,
      email: savedUser.email,
      event: 'USER_REGISTERED',
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider: 'local',
    });

    return {
      message:
        'Registration successful. Please check your email to verify your account.',
      user: this.sanitizeUser(savedUser),
    };
  }

  // ---------------------------------------------------------------------------
  // 2. LOGIN & REMEMBER ME
  // ---------------------------------------------------------------------------
  async login(loginDto: LoginDto, metadata?: ClientMetadata) {
    const email = CryptoUtil.normalizeEmail(loginDto.email);

    // Retrieve user including hidden passwordHash
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      // Record failed attempt for tracking
      await this.loginHistoryService.logEvent({
        email,
        event: AuthEvent.LOGIN_FAILED,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        device: metadata?.deviceName,
        provider: 'local',
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    // Check account lockout
    if (user.lockoutUntil && new Date() < new Date(user.lockoutUntil)) {
      const waitMinutes = Math.ceil(
        (new Date(user.lockoutUntil).getTime() - Date.now()) / (60 * 1000),
      );
      throw new UnauthorizedException(
        `Account is temporarily locked due to repeated failed login attempts. Please try again in ${waitMinutes} minute(s).`,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        'Account is disabled. Please contact your administrator.',
      );
    }

    // Check if user registered via OAuth only without setting password
    if (!user.passwordHash) {
      await this.loginHistoryService.logEvent({
        userId: user.id,
        email,
        event: AuthEvent.LOGIN_FAILED,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        device: metadata?.deviceName,
        provider: 'local',
      });
      throw new UnauthorizedException(
        'This account was registered using Google or Microsoft. Please sign in with your provider.',
      );
    }

    // Verify password securely
    const isPasswordValid = await CryptoUtil.comparePassword(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;

      if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = new Date();
        lockoutTime.setMinutes(
          lockoutTime.getMinutes() + this.LOCKOUT_MINUTES,
        );
        user.lockoutUntil = lockoutTime;

        await this.loginHistoryService.logEvent({
          userId: user.id,
          email,
          event: AuthEvent.ACCOUNT_LOCKED,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
          device: metadata?.deviceName,
          provider: 'local',
        });
      }

      await this.userRepo.save(user);

      await this.loginHistoryService.logEvent({
        userId: user.id,
        email,
        event: AuthEvent.LOGIN_FAILED,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
        device: metadata?.deviceName,
        provider: 'local',
      });

      throw new UnauthorizedException('Invalid email or password');
    }

    // Password valid -> Reset failed attempts
    if (user.failedLoginAttempts > 0 || user.lockoutUntil) {
      user.failedLoginAttempts = 0;
      user.lockoutUntil = null;
      await this.userRepo.save(user);
    }

    // Generate Refresh Token & Session
    const rawRefreshToken = CryptoUtil.generateRandomToken(40);
    const session = await this.sessionsService.createSession({
      userId: user.id,
      refreshToken: rawRefreshToken,
      rememberMe: loginDto.rememberMe,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      deviceName: metadata?.deviceName,
    });

    // Generate JWT Access Token
    const accessToken = this.generateAccessToken(user, session.id);

    await this.loginHistoryService.logEvent({
      userId: user.id,
      email: user.email,
      event: AuthEvent.LOGIN_SUCCESS,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider: 'local',
    });

    return {
      message: 'Login successful',
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken: `${session.id}.${rawRefreshToken}`,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        isRememberMe: session.isRememberMe,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 3. REFRESH TOKEN
  // ---------------------------------------------------------------------------
  async refreshAccessToken(
    rawTokenCombined: string,
    metadata?: ClientMetadata,
  ) {
    if (!rawTokenCombined || !rawTokenCombined.includes('.')) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const [sessionId, rawSecret] = rawTokenCombined.split('.');
    const session = await this.sessionsService.validateSession(
      sessionId,
      rawSecret,
    );

    // Rotate refresh token
    const newRawSecret = CryptoUtil.generateRandomToken(40);
    await this.sessionsService.updateSessionActivity(sessionId, newRawSecret);

    const accessToken = this.generateAccessToken(session.user, session.id);

    return {
      accessToken,
      refreshToken: `${session.id}.${newRawSecret}`,
      user: this.sanitizeUser(session.user),
    };
  }

  // ---------------------------------------------------------------------------
  // 4. LOGOUT
  // ---------------------------------------------------------------------------
  async logout(
    sessionId: string,
    user: User,
    metadata?: ClientMetadata,
  ): Promise<{ message: string }> {
    await this.sessionsService.revokeSession(sessionId, user.id);

    await this.loginHistoryService.logEvent({
      userId: user.id,
      email: user.email,
      event: AuthEvent.LOGOUT,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider: 'local',
    });

    return { message: 'Logged out successfully' };
  }

  async logoutAll(
    user: User,
    metadata?: ClientMetadata,
  ): Promise<{ message: string; count: number }> {
    const count = await this.sessionsService.revokeAllSessions(user.id);

    await this.loginHistoryService.logEvent({
      userId: user.id,
      email: user.email,
      event: AuthEvent.SESSION_REVOKED,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider: 'local',
    });

    return {
      message: 'Successfully logged out from all sessions',
      count,
    };
  }

  // ---------------------------------------------------------------------------
  // 5. FORGOT PASSWORD (PREVENTS USER ENUMERATION)
  // ---------------------------------------------------------------------------
  async forgotPassword(dto: ForgotPasswordDto, metadata?: ClientMetadata) {
    const email = CryptoUtil.normalizeEmail(dto.email);
    const user = await this.userRepo.findOne({ where: { email } });

    // Always return constant message to prevent enumeration attacks
    const genericResponse = {
      message:
        'If this email address is registered, a password reset link has been sent.',
    };

    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Invalidate existing active reset tokens
    await this.tokenRepo.update(
      { userId: user.id, type: TokenType.PASSWORD_RESET, usedAt: null as any },
      { usedAt: new Date() },
    );

    // Generate secure token
    const rawResetToken = CryptoUtil.generateRandomToken(32);
    const tokenHash = CryptoUtil.hashToken(rawResetToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1-hour expiration

    const record = this.tokenRepo.create({
      userId: user.id,
      tokenHash,
      type: TokenType.PASSWORD_RESET,
      expiresAt,
      usedAt: null,
    });
    await this.tokenRepo.save(record);

    await this.emailService.sendPasswordReset(user.email, rawResetToken);

    return genericResponse;
  }

  // ---------------------------------------------------------------------------
  // 6. RESET PASSWORD
  // ---------------------------------------------------------------------------
  async resetPassword(dto: ResetPasswordDto, metadata?: ClientMetadata) {
    const tokenHash = CryptoUtil.hashToken(dto.token);

    const tokenRecord = await this.tokenRepo.findOne({
      where: {
        tokenHash,
        type: TokenType.PASSWORD_RESET,
      },
      relations: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException('This reset token has already been used');
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      throw new BadRequestException('Password reset token has expired');
    }

    const user = tokenRecord.user;
    if (!user || !user.isActive) {
      throw new BadRequestException('Account not found or inactive');
    }

    // Hash new password securely
    user.passwordHash = await CryptoUtil.hashPassword(dto.password);
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await this.userRepo.save(user);

    // Mark reset token as used
    tokenRecord.usedAt = new Date();
    await this.tokenRepo.save(tokenRecord);

    // Revoke all existing sessions to enforce security
    await this.sessionsService.revokeAllSessions(user.id);

    await this.loginHistoryService.logEvent({
      userId: user.id,
      email: user.email,
      event: AuthEvent.PASSWORD_RESET,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider: 'local',
    });

    return {
      message:
        'Password has been reset successfully. Please log in with your new password.',
    };
  }

  // ---------------------------------------------------------------------------
  // 7. CHANGE PASSWORD (AUTHENTICATED)
  // ---------------------------------------------------------------------------
  async changePassword(
    userId: number,
    currentSessionId: string,
    dto: ChangePasswordDto,
    metadata?: ClientMetadata,
  ) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.passwordHash) {
      const isCurrentValid = await CryptoUtil.comparePassword(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isCurrentValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      const isSamePassword = await CryptoUtil.comparePassword(
        dto.newPassword,
        user.passwordHash,
      );
      if (isSamePassword) {
        throw new BadRequestException(
          'New password cannot be the same as your current password',
        );
      }
    }

    user.passwordHash = await CryptoUtil.hashPassword(dto.newPassword);
    await this.userRepo.save(user);

    // Revoke all other sessions (keeps current session active)
    await this.sessionsService.revokeOtherSessions(user.id, currentSessionId);

    await this.loginHistoryService.logEvent({
      userId: user.id,
      email: user.email,
      event: AuthEvent.PASSWORD_CHANGED,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider: 'local',
    });

    return {
      message:
        'Password changed successfully. All other active sessions have been signed out.',
    };
  }

  // ---------------------------------------------------------------------------
  // 8. EMAIL VERIFICATION
  // ---------------------------------------------------------------------------
  async verifyEmail(token: string) {
    const tokenHash = CryptoUtil.hashToken(token);

    const tokenRecord = await this.tokenRepo.findOne({
      where: {
        tokenHash,
        type: TokenType.EMAIL_VERIFICATION,
      },
      relations: { user: true },
    });

    if (!tokenRecord) {
      throw new BadRequestException('Invalid verification token');
    }

    if (tokenRecord.usedAt) {
      throw new BadRequestException('Email has already been verified');
    }

    if (new Date() > new Date(tokenRecord.expiresAt)) {
      throw new BadRequestException(
        'Verification token has expired. Please request a new one.',
      );
    }

    const user = tokenRecord.user;
    user.isEmailVerified = true;
    await this.userRepo.save(user);

    tokenRecord.usedAt = new Date();
    await this.tokenRepo.save(tokenRecord);

    return {
      message: 'Email verified successfully. You can now access all CRM features.',
    };
  }

  async resendVerification(emailRaw: string) {
    const email = CryptoUtil.normalizeEmail(emailRaw);
    const user = await this.userRepo.findOne({ where: { email } });

    const genericResponse = {
      message:
        'If this account exists and is unverified, a new verification link has been sent.',
    };

    if (!user || user.isEmailVerified || !user.isActive) {
      return genericResponse;
    }

    // Invalidate existing tokens
    await this.tokenRepo.update(
      {
        userId: user.id,
        type: TokenType.EMAIL_VERIFICATION,
        usedAt: null as any,
      },
      { usedAt: new Date() },
    );

    const rawToken = CryptoUtil.generateRandomToken(32);
    const tokenHash = CryptoUtil.hashToken(rawToken);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const record = this.tokenRepo.create({
      userId: user.id,
      tokenHash,
      type: TokenType.EMAIL_VERIFICATION,
      expiresAt,
      usedAt: null,
    });
    await this.tokenRepo.save(record);

    await this.emailService.sendEmailVerification(user.email, rawToken);

    return genericResponse;
  }

  // ---------------------------------------------------------------------------
  // 9. PROFILE MANAGEMENT
  // ---------------------------------------------------------------------------
  async getProfile(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    if (dto.firstName !== undefined) user.firstName = dto.firstName.trim();
    if (dto.lastName !== undefined) user.lastName = dto.lastName.trim();
    if (dto.phoneNumber !== undefined) user.phoneNumber = dto.phoneNumber;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;

    const saved = await this.userRepo.save(user);
    return {
      message: 'Profile updated successfully',
      user: this.sanitizeUser(saved),
    };
  }

  // ---------------------------------------------------------------------------
  // 10. OAUTH LOGIN FINISHER (Creates session & JWT)
  // ---------------------------------------------------------------------------
  async finishOAuthLogin(
    user: User,
    provider: 'google' | 'microsoft',
    metadata?: ClientMetadata,
    rememberMe = true,
  ) {
    const rawRefreshToken = CryptoUtil.generateRandomToken(40);
    const session = await this.sessionsService.createSession({
      userId: user.id,
      refreshToken: rawRefreshToken,
      rememberMe,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      deviceName: metadata?.deviceName,
    });

    const accessToken = this.generateAccessToken(user, session.id);

    const event =
      provider === 'google'
        ? AuthEvent.GOOGLE_LOGIN
        : AuthEvent.MICROSOFT_LOGIN;

    await this.loginHistoryService.logEvent({
      userId: user.id,
      email: user.email,
      event,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      device: metadata?.deviceName,
      provider,
    });

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken: `${session.id}.${rawRefreshToken}`,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
        isRememberMe: session.isRememberMe,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // TOKEN GENERATOR & SANITIZER
  // ---------------------------------------------------------------------------
  generateAccessToken(user: User, sessionId: string): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      workspaceId: user.workspaceId,
    };

    const expiresIn =
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') || '15m';

    return this.jwtService.sign(payload, { expiresIn } as any);
  }

  sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      phoneNumber: user.phoneNumber,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      workspaceId: user.workspaceId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
