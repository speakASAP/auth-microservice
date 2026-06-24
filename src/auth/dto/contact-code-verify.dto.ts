import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ContactCodeVerifyDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}
