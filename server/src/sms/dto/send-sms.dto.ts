import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class SmsRecipientDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsObject()
  variables: Record<string, string>;
}

export class SendSmsDto {
  @IsString()
  @IsNotEmpty()
  templateKey: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SmsRecipientDto)
  recipients: SmsRecipientDto[];
}
