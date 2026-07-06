/**
 * Register DTO
 */

import { IsEmail, IsString, MinLength, IsOptional, IsUrl } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  client_id?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}

