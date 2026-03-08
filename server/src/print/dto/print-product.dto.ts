import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/swagger';

export class SizeOptionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsString()
  @IsNotEmpty()
  value: string;
}

export class CreatePrintProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsIn(['TSHIRT', 'FRAME', 'MUG', 'OTHER'])
  productType: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SizeOptionDto)
  sizes: SizeOptionDto[];

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  basePrice: number;

  @IsString()
  @IsOptional()
  image?: string;
}

export class UpdatePrintProductDto extends PartialType(CreatePrintProductDto) {}
