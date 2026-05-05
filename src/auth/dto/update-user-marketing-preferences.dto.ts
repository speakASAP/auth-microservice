import {
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  ArrayMaxSize,
} from 'class-validator';

export class UpdateUserMarketingPreferencesDto {
  @IsOptional()
  @IsIn(['email', 'telegram', 'whatsapp', 'none'])
  preferredChannel?: 'email' | 'telegram' | 'whatsapp' | 'none' | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  fallbackChannels?: string[] | null;

  @IsOptional()
  @IsObject()
  perApplicationPreferences?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  perBrandPreferences?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  marketingConsents?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  transactionalOnly?: boolean | null;

  @IsOptional()
  @IsISO8601()
  unsubscribedAt?: string | null;
}
