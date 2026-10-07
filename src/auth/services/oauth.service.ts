import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OAuthAccount } from '../entities/oauth-account.entity.js';
import { User, UserRole } from '../entities/user.entity.js';
import { CryptoUtil } from '../utils/crypto.util.js';

export interface OAuthUserProfile {
  provider: 'google' | 'microsoft';
  providerUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
}

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  // Store valid state tokens temporarily in-memory with expiration
  private readonly stateStore = new Map<
    string,
    { expiresAt: number; userId?: number; isConnect?: boolean }
  >();

  constructor(
    @InjectRepository(OAuthAccount)
    private readonly oauthRepo: Repository<OAuthAccount>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  generateState(userId?: number, isConnect = false): string {
    const state = CryptoUtil.generateRandomToken(24);
    // 10 minutes lifetime for OAuth state
    this.stateStore.set(state, {
      expiresAt: Date.now() + 10 * 60 * 1000,
      userId,
      isConnect,
    });
    return state;
  }

  validateState(state: string): { userId?: number; isConnect?: boolean } {
    const entry = this.stateStore.get(state);
    if (!entry) {
      throw new BadRequestException('Invalid or expired OAuth state parameter');
    }
    this.stateStore.delete(state);
    if (Date.now() > entry.expiresAt) {
      throw new BadRequestException('OAuth state has expired');
    }
    return entry;
  }

  getGoogleAuthUrl(state: string): string {
    const clientId =
      this.configService.get<string>('GOOGLE_CLIENT_ID') || 'mock-google-client-id';
    const callbackUrl =
      this.configService.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:3000/api/auth/google/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  getMicrosoftAuthUrl(state: string): string {
    const clientId =
      this.configService.get<string>('MICROSOFT_CLIENT_ID') ||
      'mock-microsoft-client-id';
    const callbackUrl =
      this.configService.get<string>('MICROSOFT_CALLBACK_URL') ||
      'http://localhost:3000/api/auth/microsoft/callback';

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: callbackUrl,
      response_mode: 'query',
      scope: 'openid profile email User.Read',
      state,
    });

    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  }

  async exchangeGoogleCode(code: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackUrl =
      this.configService.get<string>('GOOGLE_CALLBACK_URL') ||
      'http://localhost:3000/api/auth/google/callback';

    // Development fallback mock profile if credentials are not configured
    if (!clientId || clientId === 'mock-google-client-id' || !clientSecret) {
      this.logger.warn(
        'Google OAuth credentials not configured in .env. Using mock Google profile for testing.',
      );
      return {
        provider: 'google',
        providerUserId: `google-mock-${code}`,
        email: `google.user.${code}@example.com`,
        firstName: 'Google',
        lastName: 'User',
      };
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        throw new UnauthorizedException('Failed to exchange Google OAuth code');
      }

      const tokenData = await tokenRes.json();
      const profileRes = await fetch(
        'https://www.googleapis.com/oauth2/v3/userinfo',
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        },
      );

      if (!profileRes.ok) {
        throw new UnauthorizedException('Failed to fetch Google user profile');
      }

      const profile = await profileRes.json();
      return {
        provider: 'google',
        providerUserId: profile.sub,
        email: CryptoUtil.normalizeEmail(profile.email),
        firstName: profile.given_name || 'GoogleUser',
        lastName: profile.family_name || '',
        avatarUrl: profile.picture,
      };
    } catch (error) {
      this.logger.error('Google OAuth exchange error', error);
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  async exchangeMicrosoftCode(code: string): Promise<OAuthUserProfile> {
    const clientId = this.configService.get<string>('MICROSOFT_CLIENT_ID');
    const clientSecret = this.configService.get<string>('MICROSOFT_CLIENT_SECRET');
    const callbackUrl =
      this.configService.get<string>('MICROSOFT_CALLBACK_URL') ||
      'http://localhost:3000/api/auth/microsoft/callback';

    // Development fallback mock profile
    if (!clientId || clientId === 'mock-microsoft-client-id' || !clientSecret) {
      this.logger.warn(
        'Microsoft OAuth credentials not configured in .env. Using mock Microsoft profile for testing.',
      );
      return {
        provider: 'microsoft',
        providerUserId: `ms-mock-${code}`,
        email: `ms.user.${code}@example.com`,
        firstName: 'Microsoft',
        lastName: 'User',
      };
    }

    try {
      const tokenRes = await fetch(
        'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: callbackUrl,
            grant_type: 'authorization_code',
          }),
        },
      );

      if (!tokenRes.ok) {
        throw new UnauthorizedException('Failed to exchange Microsoft OAuth code');
      }

      const tokenData = await tokenRes.json();
      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!profileRes.ok) {
        throw new UnauthorizedException('Failed to fetch Microsoft profile');
      }

      const profile = await profileRes.json();
      const email = CryptoUtil.normalizeEmail(
        profile.mail || profile.userPrincipalName,
      );

      return {
        provider: 'microsoft',
        providerUserId: profile.id,
        email,
        firstName: profile.givenName || profile.displayName || 'MicrosoftUser',
        lastName: profile.surname || '',
      };
    } catch (error) {
      this.logger.error('Microsoft OAuth exchange error', error);
      throw new UnauthorizedException('Failed to authenticate with Microsoft');
    }
  }

  async findOrCreateUserByOAuth(profile: OAuthUserProfile): Promise<User> {
    // 1. Check if OAuth account already exists
    const existingOAuth = await this.oauthRepo.findOne({
      where: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
      relations: { user: true },
    });

    if (existingOAuth && existingOAuth.user) {
      return existingOAuth.user;
    }

    // 2. Check if a user with this email already exists
    let user = await this.userRepo.findOne({
      where: { email: profile.email },
    });

    if (user) {
      // Prevent unsafe takeover: link only if active
      if (!user.isActive) {
        throw new UnauthorizedException('Account is inactive');
      }
      user.isEmailVerified = true;
      await this.userRepo.save(user);
    } else {
      // 3. Create new user
      user = this.userRepo.create({
        email: profile.email,
        firstName: profile.firstName || 'User',
        lastName: profile.lastName || '',
        avatarUrl: profile.avatarUrl || null,
        isEmailVerified: true, // OAuth emails from Google/Microsoft are pre-verified
        isActive: true,
        role: UserRole.MEMBER,
      });
      user = await this.userRepo.save(user);
    }

    // 4. Create OAuthAccount link
    const newOAuth = this.oauthRepo.create({
      userId: user.id,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      providerEmail: profile.email,
    });
    await this.oauthRepo.save(newOAuth);

    return user;
  }

  async connectOAuthAccount(
    userId: number,
    profile: OAuthUserProfile,
  ): Promise<OAuthAccount> {
    const existing = await this.oauthRepo.findOne({
      where: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    });

    if (existing) {
      if (existing.userId === userId) {
        return existing;
      }
      throw new ConflictException(
        'This external account is already linked to another user',
      );
    }

    const linked = this.oauthRepo.create({
      userId,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      providerEmail: profile.email,
    });

    return await this.oauthRepo.save(linked);
  }

  async getConnectedAccounts(userId: number) {
    const accounts = await this.oauthRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return accounts.map((acc) => ({
      id: acc.id,
      provider: acc.provider,
      providerEmail: acc.providerEmail,
      createdAt: acc.createdAt,
    }));
  }

  async disconnectProvider(
    userId: number,
    provider: 'google' | 'microsoft',
  ): Promise<{ message: string }> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.oauthAccounts', 'oauth')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const targetAccount = user.oauthAccounts.find(
      (a) => a.provider.toLowerCase() === provider.toLowerCase(),
    );

    if (!targetAccount) {
      throw new BadRequestException(
        `No connected ${provider} account found for this user`,
      );
    }

    // Security check: Never disconnect if no password set AND only 1 OAuth account
    if (!user.passwordHash && user.oauthAccounts.length <= 1) {
      throw new BadRequestException(
        'Cannot disconnect your only authentication method. Please set a password first.',
      );
    }

    await this.oauthRepo.remove(targetAccount);
    return { message: `Successfully disconnected ${provider} account` };
  }
}
