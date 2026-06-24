/**
 * Login DTO
 */

import { IsString, ValidateIf } from 'class-validator';

export class LoginDto {
  @ValidateIf((dto) => !dto.identifier)
  @IsString()
  email?: string;

  @ValidateIf((dto) => !dto.email)
  @IsString()
  identifier?: string;

  @IsString()
  password: string;
}
