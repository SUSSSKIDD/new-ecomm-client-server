import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CheckServiceabilityDto {
  @ApiProperty({ description: 'User latitude', example: 12.9716 })
  @Type(() => Number)
  @IsNumber()
  lat: number;

  @ApiProperty({ description: 'User longitude', example: 77.5946 })
  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiProperty({ description: 'Optional user pincode', example: '221104', required: false })
  @IsOptional()
  @IsString()
  pincode?: string;
}
