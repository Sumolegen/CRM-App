import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from './services/auth.service.js';
import { User, UserRole } from './entities/user.entity.js';
import { TokenType } from './entities/verification-token.entity.js';
import { ConflictException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { CryptoUtil } from './utils/crypto.util.js';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepo: any;
  let mockTokenRepo: any;
  let mockJwtService: any;
  let mockConfigService: any;
  let mockSessionsService: any;
  let mockEmailService: any;
  let mockLoginHistoryService: any;

  beforeEach(() => {
    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 1 })),
      save: vi.fn().mockImplementation((user) => Promise.resolve({ ...user, id: user.id || 1 })),
      createQueryBuilder: vi.fn(),
    };

    mockTokenRepo = {
      findOne: vi.fn(),
      create: vi.fn().mockImplementation((dto) => ({ ...dto, id: 1 })),
      save: vi.fn().mockImplementation((rec) => Promise.resolve({ ...rec, id: rec.id || 1 })),
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock.jwt.token'),
    };

    mockConfigService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        if (key === 'JWT_ACCESS_EXPIRATION') return '15m';
        return null;
      }),
    };

    mockSessionsService = {
      createSession: vi.fn().mockResolvedValue({
        id: 'session-uuid-1',
        userId: 1,
        isRememberMe: false,
        expiresAt: new Date(Date.now() + 86400000),
      }),
      validateSession: vi.fn(),
      updateSessionActivity: vi.fn(),
      revokeSession: vi.fn().mockResolvedValue(undefined),
      revokeAllSessions: vi.fn().mockResolvedValue(2),
      revokeOtherSessions: vi.fn().mockResolvedValue(1),
    };

    mockEmailService = {
      sendEmailVerification: vi.fn().mockResolvedValue(undefined),
      sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    };

    mockLoginHistoryService = {
      logEvent: vi.fn().mockResolvedValue({}),
      getUserHistory: vi.fn().mockResolvedValue([]),
    };

    authService = new AuthService(
      mockUserRepo,
      mockTokenRepo,
      mockJwtService,
      mockConfigService,
      mockSessionsService,
      mockEmailService,
      mockLoginHistoryService,
    );
  });

  describe('register', () => {
    it('should register a new user successfully and send verification email', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      const result = await authService.register({
        email: 'test@example.com',
        password: 'Password123!',
        firstName: 'Alex',
        lastName: 'Morgan',
      });

      expect(result.message).toContain('Registration successful');
      expect(result.user.email).toBe('test@example.com');
      expect((result.user as any).passwordHash).toBeUndefined();
      expect(mockEmailService.sendEmailVerification).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
      expect(mockTokenRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is already taken', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 99, email: 'test@example.com' });

      await expect(
        authService.register({
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'Alex',
          lastName: 'Morgan',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return access/refresh tokens', async () => {
      const hashedPassword = await CryptoUtil.hashPassword('Password123!');
      const fakeUser: Partial<User> = {
        id: 1,
        email: 'user@example.com',
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        lockoutUntil: null,
        role: UserRole.MEMBER,
        workspaceId: 'ws-123',
      };

      const queryBuilderMock = {
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(fakeUser),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);

      const result = await authService.login({
        email: 'user@example.com',
        password: 'Password123!',
        rememberMe: true,
      });

      expect(result.message).toBe('Login successful');
      expect(result.accessToken).toBe('mock.jwt.token');
      expect(result.refreshToken).toContain('session-uuid-1.');
      expect(mockSessionsService.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          rememberMe: true,
        }),
      );
    });

    it('should reject invalid password and increment failed attempts', async () => {
      const hashedPassword = await CryptoUtil.hashPassword('CorrectPassword123!');
      const fakeUser: Partial<User> = {
        id: 1,
        email: 'user@example.com',
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 0,
        lockoutUntil: null,
      };

      const queryBuilderMock = {
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(fakeUser),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(fakeUser.failedLoginAttempts).toBe(1);
      expect(mockUserRepo.save).toHaveBeenCalledWith(fakeUser);
    });

    it('should lock account when failed attempts threshold is reached', async () => {
      const hashedPassword = await CryptoUtil.hashPassword('CorrectPassword123!');
      const fakeUser: Partial<User> = {
        id: 1,
        email: 'user@example.com',
        passwordHash: hashedPassword,
        isActive: true,
        failedLoginAttempts: 4, // 5th will trigger lock
        lockoutUntil: null,
      };

      const queryBuilderMock = {
        addSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(fakeUser),
      };
      mockUserRepo.createQueryBuilder.mockReturnValue(queryBuilderMock);

      await expect(
        authService.login({
          email: 'user@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);

      expect(fakeUser.failedLoginAttempts).toBe(5);
      expect(fakeUser.lockoutUntil).not.toBeNull();
    });
  });

  describe('forgotPassword & resetPassword', () => {
    it('should return generic response and trigger reset email if user exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'user@example.com',
        isActive: true,
      });

      const res = await authService.forgotPassword({ email: 'user@example.com' });
      expect(res.message).toContain('password reset link has been sent');
      expect(mockEmailService.sendPasswordReset).toHaveBeenCalledWith(
        'user@example.com',
        expect.any(String),
      );
    });

    it('should reset password, revoke all sessions, and invalidate reset token', async () => {
      const rawToken = 'sample-reset-token';
      const tokenHash = CryptoUtil.hashToken(rawToken);

      const fakeUser: Partial<User> = {
        id: 1,
        email: 'user@example.com',
        isActive: true,
        passwordHash: 'old-hash',
      };

      const fakeToken = {
        id: 1,
        userId: 1,
        tokenHash,
        type: TokenType.PASSWORD_RESET,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
        user: fakeUser,
      };

      mockTokenRepo.findOne.mockResolvedValue(fakeToken);

      const res = await authService.resetPassword({
        token: rawToken,
        password: 'NewStrongPassword123!',
      });

      expect(res.message).toContain('Password has been reset successfully');
      expect(fakeToken.usedAt).not.toBeNull();
      expect(mockSessionsService.revokeAllSessions).toHaveBeenCalledWith(1);
    });
  });

  describe('verifyEmail', () => {
    it('should mark email as verified and update usedAt timestamp', async () => {
      const rawToken = 'sample-verify-token';
      const tokenHash = CryptoUtil.hashToken(rawToken);

      const fakeUser: Partial<User> = {
        id: 1,
        isEmailVerified: false,
      };

      const fakeRecord = {
        id: 1,
        tokenHash,
        type: TokenType.EMAIL_VERIFICATION,
        expiresAt: new Date(Date.now() + 86400000),
        usedAt: null,
        user: fakeUser,
      };

      mockTokenRepo.findOne.mockResolvedValue(fakeRecord);

      const res = await authService.verifyEmail(rawToken);
      expect(res.message).toContain('Email verified successfully');
      expect(fakeUser.isEmailVerified).toBe(true);
      expect(fakeRecord.usedAt).not.toBeNull();
    });
  });
});
