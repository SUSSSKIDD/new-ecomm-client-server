import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({ example: 'Homdrop Warehouse Central' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '560001' })
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty({ example: 12.9716 })
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 77.5946 })
  @IsNumber()
  lng: number;

  @ApiPropertyOptional({ example: '123 Main St, Bengaluru' })
  @IsString()
  @IsOptional()
  address?: string;
}
