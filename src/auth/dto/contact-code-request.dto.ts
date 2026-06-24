import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class ContactCodeRequestDto {
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsUrl({ require_tld: false })
  @IsNotEmpty()
  return_url: string;

  @IsOptional()
  @IsString()
  client_id?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  app_domain?: string;
}
