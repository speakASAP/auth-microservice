import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class MagicLinkVerifyDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}

