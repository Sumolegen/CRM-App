import { IsBoolean, IsNotEmpty, IsUUID } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}

export class UpdateMemberStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
