import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { StoreManagerService } from './store-manager.service';
import { CreateStoreManagerDto } from './dto/create-store-manager.dto';
import { UpdateStoreManagerDto } from './dto/update-store-manager.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('store-managers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
@Controller('store-managers')
export class StoreManagerController {
    constructor(private readonly storeManagerService: StoreManagerService) { }

    @Post()
    @ApiOperation({ summary: 'Create a store manager (Admin)' })
    create(@Body() dto: CreateStoreManagerDto) {
        return this.storeManagerService.create(dto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all store managers (Admin)' })
    findAll() {
        return this.storeManagerService.findAll();
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a store manager (Admin)' })
    findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.storeManagerService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a store manager (Admin)' })
    update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStoreManagerDto) {
        return this.storeManagerService.update(id, dto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a store manager (Admin)' })
    remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.storeManagerService.remove(id);
    }
}
