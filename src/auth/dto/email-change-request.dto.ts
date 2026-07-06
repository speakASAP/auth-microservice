import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class EmailChangeRequestDto {
  @IsEmail()
  newEmail: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  return_url?: string;
}
