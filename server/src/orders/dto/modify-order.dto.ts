import { IsArray, ValidateNested, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ModifyItemDto {
  @ApiProperty({ description: 'Product ID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'New quantity (0 = remove item)' })
  @IsInt()
  @Min(0)
  quantity: number;
}

export class ModifyOrderDto {
  @ApiProperty({ type: [ModifyItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModifyItemDto)
  items: ModifyItemDto[];
}
