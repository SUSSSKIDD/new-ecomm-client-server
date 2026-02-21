import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';
import { SmsType } from '@prisma/client';

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(SmsType)
  @IsOptional()
  type?: SmsType;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  msg91TemplateId?: string;

  @IsString()
  @IsOptional()
  msg91FlowId?: string;
}
