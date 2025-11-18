/**
 * Contact-Based Registration DTO
 */

import { IsString, IsArray, ValidateNested, IsOptional, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum ContactType {
  EMAIL = 'email',
  PHONE = 'phone',
}

export class ContactInfoDto {
  @IsEnum(ContactType)
  type: ContactType;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  isPrimary?: boolean;
}

export class ContactRegisterDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactInfoDto)
  contactInfo: ContactInfoDto[];

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

