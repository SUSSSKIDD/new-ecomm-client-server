import { IsUUID, IsInt, IsString, IsArray, IsOptional, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddToCartDto {
  @ApiProperty({ description: 'Product ID to add to cart' })
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ description: 'Quantity to add', minimum: 1, maximum: 50, example: 1 })
  @IsInt()
  @Min(1)
  @Max(50)
  quantity: number;

  @ApiPropertyOptional({ description: 'Selected size (e.g., "L", "8x10")' })
  @IsString()
  @IsOptional()
  selectedSize?: string;

  @ApiPropertyOptional({ description: 'User-uploaded design/photo URLs' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  userUploadUrls?: string[];

  @ApiPropertyOptional({ description: 'Print product ID (for design printing)' })
  @IsUUID()
  @IsOptional()
  printProductId?: string;
}
