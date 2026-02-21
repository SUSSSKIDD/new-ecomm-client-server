import { IsUUID, IsInt, Min, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateInventoryDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'Stock count', minimum: 0 })
  @IsInt()
  @Min(0)
  stock: number;
}

export class BulkUpdateInventoryDto {
  @ApiProperty({ type: [UpdateInventoryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateInventoryDto)
  items: UpdateInventoryDto[];
}
