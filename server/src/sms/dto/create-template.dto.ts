import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { SmsType } from '@prisma/client';

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(SmsType)
  @IsOptional()
  type?: SmsType;

  @IsString()
  @IsOptional()
  msg91TemplateId?: string;

  @IsString()
  @IsOptional()
  msg91FlowId?: string;
}
