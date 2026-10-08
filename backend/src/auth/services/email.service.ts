import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SentEmailRecord {
  to: string;
  subject: string;
  html: string;
  sentAt: Date;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  public lastSentEmail: SentEmailRecord | null = null;

  constructor(private readonly configService: ConfigService) {}

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

    const subject = 'Verify your email address - CRM';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Verify Your Email</h2>
        <p>Thank you for creating an account with our CRM. Please confirm your email address by clicking the link below:</p>
        <p><a href="${verifyUrl}" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #4B5563;">${verifyUrl}</p>
        <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">This link will expire in 24 hours.</p>
      </div>
    `;

    this.lastSentEmail = { to: email, subject, html, sentAt: new Date() };
    this.logger.log(`[Email Dispatch] Verification email sent to: ${email}`);
    this.logger.debug(`[Verification Link] ${verifyUrl}`);
  }

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const subject = 'Reset your password - CRM';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your CRM password. Click the link below to set a new password:</p>
        <p><a href="${resetUrl}" style="background-color: #DC2626; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a></p>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #4B5563;">${resetUrl}</p>
        <p style="color: #6B7280; font-size: 12px; margin-top: 30px;">If you did not request this, please ignore this email. This link will expire in 1 hour.</p>
      </div>
    `;

    this.lastSentEmail = { to: email, subject, html, sentAt: new Date() };
    this.logger.log(`[Email Dispatch] Password reset email sent to: ${email}`);
    this.logger.debug(`[Password Reset Link] ${resetUrl}`);
  }
}
