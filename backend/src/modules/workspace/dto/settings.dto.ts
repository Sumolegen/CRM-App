import { IsBoolean, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateWorkspaceSettingsDto {
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsNumber()
  fiscalYearStart?: number;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsUrl()
  logoUrl?: string;

  @IsOptional()
  @IsUrl()
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  defaultLanguage?: string;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  timeFormat?: string;

  @IsOptional()
  @IsBoolean()
  enforce2FA?: boolean;

  @IsOptional()
  @IsString({ each: true })
  allowedDomains?: string[];

  @IsOptional()
  @IsNumber()
  sessionTimeoutMinutes?: number;
}
