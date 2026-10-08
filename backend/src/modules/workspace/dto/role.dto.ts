import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { WorkspaceRole } from '../enums/workspace-role.enum';

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(WorkspaceRole)
  @IsOptional()
  type?: WorkspaceRole = WorkspaceRole.CUSTOM;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}

export class UpdateRoleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[];
}
