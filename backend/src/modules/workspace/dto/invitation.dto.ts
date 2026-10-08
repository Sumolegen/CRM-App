import { IsEmail, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsUUID()
  @IsNotEmpty()
  roleId: string;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
