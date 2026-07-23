import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ContactCodeVerifyDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsIn(['login', 'recovery'])
  purpose?: 'login' | 'recovery';

  // Without this the set-password URL is built with the default language and a Czech or
  // Russian user is dropped onto an English screen mid-recovery. The request DTO already
  // carries lang; verify is the step that builds the redirect, so it needs it too.
  @IsOptional()
  @IsIn(['en', 'cs', 'ru'])
  lang?: 'en' | 'cs' | 'ru';

  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;

  @IsOptional()
  @IsString()
  client_id?: string;
}
