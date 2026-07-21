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

  /**
   * Opaque handle round-tripped by the caller, matching the `state` already accepted by the
   * magic-link, contact-code and password-reset flows. auth neither interprets nor stores it; it
   * is echoed into `auth.user.registered.v1` so a registration can be tied back to the journey
   * that produced it (C-005 §2.2b).
   */
  @IsString()
  @IsOptional()
  state?: string;
}

