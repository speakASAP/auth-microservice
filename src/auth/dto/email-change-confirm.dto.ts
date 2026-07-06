import { IsString } from 'class-validator';

export class EmailChangeConfirmDto {
  @IsString()
  token: string;
}
