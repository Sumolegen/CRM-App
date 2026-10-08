import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';

import { AuthService, ClientMetadata } from './services/auth.service.js';
import { SessionsService } from './services/sessions.service.js';
import { OAuthService } from './services/oauth.service.js';
import { LoginHistoryService } from './services/login-history.service.js';

import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { ResendVerificationDto } from './dto/resend-verification.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { CurrentSessionId } from './decorators/current-session.decorator.js';
import { User } from './entities/user.entity.js';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionsService: SessionsService,
    private readonly oauthService: OAuthService,
    private readonly loginHistoryService: LoginHistoryService,
    private readonly configService: ConfigService,
  ) {}

  private extractMetadata(req: Request): ClientMetadata {
    const forwarded = req.headers['x-forwarded-for'];
    const ipAddress = (
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]
        : req.socket.remoteAddress || '127.0.0.1'
    ).trim();

    return {
      ipAddress,
      userAgent: req.headers['user-agent'] || 'Unknown Agent',
      deviceName: req.headers['x-device-name'] as string | undefined,
    };
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe = false,
  ) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    const accessMaxAge = 15 * 60 * 1000; // 15 mins
    const refreshMaxAge = rememberMe
      ? 30 * 24 * 60 * 60 * 1000 // 30 days
      : 24 * 60 * 60 * 1000; // 1 day

    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: accessMaxAge,
      path: '/',
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: refreshMaxAge,
      path: '/',
    });
  }

  private clearAuthCookies(res: Response) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
  }

  // ---------------------------------------------------------------------------
  // 1. REGISTER
  // ---------------------------------------------------------------------------
  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const metadata = this.extractMetadata(req);
    return await this.authService.register(registerDto, metadata);
  }

  // ---------------------------------------------------------------------------
  // 2. LOGIN
  // ---------------------------------------------------------------------------
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    const result = await this.authService.login(loginDto, metadata);

    this.setAuthCookies(
      res,
      result.accessToken,
      result.refreshToken,
      loginDto.rememberMe,
    );

    return result;
  }

  // ---------------------------------------------------------------------------
  // 3. REFRESH TOKEN
  // ---------------------------------------------------------------------------
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.['refresh_token'] || body.refreshToken;
    const metadata = this.extractMetadata(req);

    const result = await this.authService.refreshAccessToken(
      refreshToken,
      metadata,
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken, false);

    return result;
  }

  // ---------------------------------------------------------------------------
  // 4. LOGOUT
  // ---------------------------------------------------------------------------
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: User,
    @CurrentSessionId() sessionId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    const result = await this.authService.logout(sessionId, user, metadata);
    this.clearAuthCookies(res);
    return result;
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: User,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    const result = await this.authService.logoutAll(user, metadata);
    this.clearAuthCookies(res);
    return result;
  }

  // ---------------------------------------------------------------------------
  // 5. FORGOT & RESET PASSWORD
  // ---------------------------------------------------------------------------
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    const metadata = this.extractMetadata(req);
    return await this.authService.forgotPassword(dto, metadata);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ) {
    const metadata = this.extractMetadata(req);
    return await this.authService.resetPassword(dto, metadata);
  }

  // ---------------------------------------------------------------------------
  // 6. CHANGE PASSWORD
  // ---------------------------------------------------------------------------
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: number,
    @CurrentSessionId() sessionId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const metadata = this.extractMetadata(req);
    return await this.authService.changePassword(
      userId,
      sessionId,
      dto,
      metadata,
    );
  }

  // ---------------------------------------------------------------------------
  // 7. EMAIL VERIFICATION
  // ---------------------------------------------------------------------------
  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return await this.authService.verifyEmail(dto.token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return await this.authService.resendVerification(dto.email);
  }

  // ---------------------------------------------------------------------------
  // 8. PROFILE
  // ---------------------------------------------------------------------------
  @Get('profile')
  async getProfile(@CurrentUser('id') userId: number) {
    return await this.authService.getProfile(userId);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateProfileDto,
  ) {
    return await this.authService.updateProfile(userId, dto);
  }

  // ---------------------------------------------------------------------------
  // 9. SESSIONS
  // ---------------------------------------------------------------------------
  @Get('sessions')
  async listSessions(
    @CurrentUser('id') userId: number,
    @CurrentSessionId() sessionId: string,
  ) {
    return await this.sessionsService.getUserSessions(userId, sessionId);
  }

  @Delete('sessions/:sessionId')
  async revokeSession(
    @CurrentUser('id') userId: number,
    @Param('sessionId') targetSessionId: string,
  ) {
    await this.sessionsService.revokeSession(targetSessionId, userId);
    return { message: 'Session revoked successfully' };
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentUser('id') userId: number,
    @CurrentSessionId() sessionId: string,
  ) {
    const count = await this.sessionsService.revokeOtherSessions(
      userId,
      sessionId,
    );
    return {
      message: `Successfully revoked ${count} other active session(s)`,
      revokedCount: count,
    };
  }

  // ---------------------------------------------------------------------------
  // 10. LOGIN AUDIT HISTORY
  // ---------------------------------------------------------------------------
  @Get('login-history')
  async getLoginHistory(@CurrentUser('id') userId: number) {
    return await this.loginHistoryService.getUserHistory(userId);
  }

  // ---------------------------------------------------------------------------
  // 11. GOOGLE OAUTH
  // ---------------------------------------------------------------------------
  @Public()
  @Get('google')
  async googleAuth(@Res() res: Response) {
    const state = this.oauthService.generateState();
    const url = this.oauthService.getGoogleAuthUrl(state);
    return res.redirect(url);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const stateData = this.oauthService.validateState(state);
    const profile = await this.oauthService.exchangeGoogleCode(code);
    const metadata = this.extractMetadata(req);

    if (stateData.isConnect && stateData.userId) {
      await this.oauthService.connectOAuthAccount(stateData.userId, profile);
      return res.redirect(
        `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/settings/connected-accounts?status=success`,
      );
    }

    const user = await this.oauthService.findOrCreateUserByOAuth(profile);
    const result = await this.authService.finishOAuthLogin(
      user,
      'google',
      metadata,
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken, true);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }

  @Get('google/connect')
  async connectGoogle(@CurrentUser('id') userId: number, @Res() res: Response) {
    const state = this.oauthService.generateState(userId, true);
    const url = this.oauthService.getGoogleAuthUrl(state);
    return res.redirect(url);
  }

  // ---------------------------------------------------------------------------
  // 12. MICROSOFT OAUTH
  // ---------------------------------------------------------------------------
  @Public()
  @Get('microsoft')
  async microsoftAuth(@Res() res: Response) {
    const state = this.oauthService.generateState();
    const url = this.oauthService.getMicrosoftAuthUrl(state);
    return res.redirect(url);
  }

  @Public()
  @Get('microsoft/callback')
  async microsoftCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const stateData = this.oauthService.validateState(state);
    const profile = await this.oauthService.exchangeMicrosoftCode(code);
    const metadata = this.extractMetadata(req);

    if (stateData.isConnect && stateData.userId) {
      await this.oauthService.connectOAuthAccount(stateData.userId, profile);
      return res.redirect(
        `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173'}/settings/connected-accounts?status=success`,
      );
    }

    const user = await this.oauthService.findOrCreateUserByOAuth(profile);
    const result = await this.authService.finishOAuthLogin(
      user,
      'microsoft',
      metadata,
    );

    this.setAuthCookies(res, result.accessToken, result.refreshToken, true);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    return res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }

  @Get('microsoft/connect')
  async connectMicrosoft(
    @CurrentUser('id') userId: number,
    @Res() res: Response,
  ) {
    const state = this.oauthService.generateState(userId, true);
    const url = this.oauthService.getMicrosoftAuthUrl(state);
    return res.redirect(url);
  }

  // ---------------------------------------------------------------------------
  // 13. CONNECTED ACCOUNTS MANAGEMENT
  // ---------------------------------------------------------------------------
  @Get('connected-accounts')
  async getConnectedAccounts(@CurrentUser('id') userId: number) {
    return await this.oauthService.getConnectedAccounts(userId);
  }

  @Delete('connected-accounts/:provider')
  async disconnectAccount(
    @CurrentUser('id') userId: number,
    @Param('provider') provider: string,
  ) {
    return await this.oauthService.disconnectProvider(
      userId,
      provider.toLowerCase() as any,
    );
  }
}
