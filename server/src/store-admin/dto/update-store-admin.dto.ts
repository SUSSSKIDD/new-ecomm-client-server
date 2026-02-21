import { PartialType } from '@nestjs/swagger';
import { CreateStoreAdminDto } from './create-store-admin.dto';

export class UpdateStoreAdminDto extends PartialType(CreateStoreAdminDto) { }
