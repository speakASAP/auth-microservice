/**
 * Password Change DTO
 */

import { IsString, MinLength } from 'class-validator';

export class PasswordChangeDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

