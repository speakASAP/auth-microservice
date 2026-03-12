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
}

