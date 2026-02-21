import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    ParseUUIDPipe,
} from '@nestjs/common';
import { StoreAdminService } from './store-admin.service';
import { CreateStoreAdminDto } from './dto/create-store-admin.dto';
import { UpdateStoreAdminDto } from './dto/update-store-admin.dto';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('store-admin')
@Controller('store-admin')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class StoreAdminController {
    constructor(private readonly storeAdminService: StoreAdminService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new Store Admin' })
    create(@Body() createStoreAdminDto: CreateStoreAdminDto) {
        return this.storeAdminService.create(createStoreAdminDto);
    }

    @Get()
    @ApiOperation({ summary: 'List all Store Admins' })
    findAll() {
        return this.storeAdminService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get Store Admin by ID' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.storeAdminService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update Store Admin' })
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateStoreAdminDto: UpdateStoreAdminDto,
    ) {
        return this.storeAdminService.update(id, updateStoreAdminDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Deactivate Store Admin' })
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.storeAdminService.remove(id);
    }
}
