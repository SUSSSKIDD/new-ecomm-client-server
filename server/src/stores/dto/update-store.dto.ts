import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateStoreDto } from './create-store.dto';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateStoreDto extends OmitType(PartialType(CreateStoreDto), ['storeType'] as const) {
  @ApiPropertyOptional({ description: 'Activate or deactivate the store' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
