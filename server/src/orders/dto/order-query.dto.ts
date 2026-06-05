import { IsOptional, IsInt, Min, Max, IsEnum, IsIn, IsString, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: ['createdAt', 'total', 'status'] })
  @IsOptional()
  @IsIn(['createdAt', 'total', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  /**
   * Cursor-based pagination — pass the `nextCursor` from the previous response.
   * When provided, `page` is ignored. Enables O(1) deep pagination regardless of dataset size.
   */
  @ApiPropertyOptional({ description: 'ID of the last order from previous page (cursor pagination)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  cursor?: string;
}
