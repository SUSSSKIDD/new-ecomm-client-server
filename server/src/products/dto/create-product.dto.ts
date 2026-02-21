import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Selling price' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ description: 'Maximum retail price' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  mrp?: number;

  @ApiProperty({ description: 'Product category' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: 'Product sub-category' })
  @IsString()
  @IsOptional()
  subCategory?: string;

  @ApiProperty({ description: 'Stock quantity' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({ description: 'Is grocery product' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  isGrocery?: boolean;

  @ApiPropertyOptional({ description: 'Store aisle location' })
  @IsString()
  @IsOptional()
  storeLocation?: string;

  @ApiPropertyOptional({
    description: 'Image URLs (auto-populated from file uploads)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  images?: string[];
}
