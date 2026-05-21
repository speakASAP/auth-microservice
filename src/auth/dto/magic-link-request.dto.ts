import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class MagicLinkRequestDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  return_url: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  state?: string;

  /** Domain shown in email header/footer (e.g. strilkove.cz). Caller sets this from their own Vault DOMAIN var. Falls back to auth-service DOMAIN env if omitted. */
  @IsOptional()
  @IsString()
  app_domain?: string;
}

