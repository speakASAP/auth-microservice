/**
 * Password Reset Request DTO
 */

import { IsEmail, IsOptional, IsString } from 'class-validator';

export class PasswordResetRequestDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  return_url?: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  state?: string;
}

