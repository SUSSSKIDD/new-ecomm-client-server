import {
  IsString,
  IsOptional,
  IsEnum,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAddressDto {
  @ApiProperty({ enum: ['HOME', 'WORK', 'OTHER'] })
  @IsEnum(['HOME', 'WORK', 'OTHER'])
  type: string;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  houseNo?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  zipCode: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  state?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  landmark?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  mapsLink?: string;

  @ApiPropertyOptional({ description: 'Recipient name for non-self delivery' })
  @IsString()
  @IsOptional()
  recipientName?: string;

  @ApiPropertyOptional({ description: 'Recipient phone for non-self delivery' })
  @IsString()
  @IsOptional()
  recipientPhone?: string;

  @ApiPropertyOptional({ description: 'Latitude from GPS' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Longitude from GPS' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
