import { PartialType } from '@nestjs/swagger';
import { CreateStoreManagerDto } from './create-store-manager.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateStoreManagerDto extends PartialType(CreateStoreManagerDto) {
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
