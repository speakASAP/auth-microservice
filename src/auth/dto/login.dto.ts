/**
 * Login DTO
 */

import { IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((dto) => !dto.identifier)
  @IsString()
  email?: string;

  @ValidateIf((dto) => !dto.email)
  @IsString()
  identifier?: string;

  @IsString()
  password: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}
