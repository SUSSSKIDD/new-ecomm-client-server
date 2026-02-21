import { Controller, Get, Post, Body, Query, UseGuards, Request } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { CreateLedgerEntryDto } from './dto/create-ledger-entry.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StoreGuard } from '../auth/guards/store.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('ledger')
@ApiBearerAuth()
@Controller('ledger')
export class LedgerController {
    constructor(private readonly ledgerService: LedgerService) { }

    @Post()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Create ledger entry (Admin)' })
    create(@Body() dto: CreateLedgerEntryDto) {
        return this.ledgerService.create(dto);
    }

    @Get()
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('ADMIN')
    @ApiOperation({ summary: 'Get all ledger entries (Admin)' })
    @ApiQuery({ name: 'storeId', required: false })
    @ApiQuery({ name: 'startDate', required: false })
    @ApiQuery({ name: 'endDate', required: false })
    findAll(
        @Query('storeId') storeId?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.ledgerService.findAll(storeId, startDate, endDate);
    }

    @Get('my-store')
    @UseGuards(AuthGuard('jwt'), RolesGuard, StoreGuard)
    @Roles('ADMIN', 'STORE_MANAGER')
    @ApiOperation({ summary: 'Get ledger entries for my store' })
    findMyStore(@Request() req) {
        return this.ledgerService.findByStore(req.user.storeId);
    }
}
