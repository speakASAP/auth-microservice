/**
 * Validate Token DTO
 */

import { IsString } from 'class-validator';

export class ValidateTokenDto {
  @IsString()
  token: string;
}

