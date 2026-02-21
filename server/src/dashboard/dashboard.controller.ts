import {
    Controller,
    Get,
    UseGuards,
    Req,
    Param,
    ParseUUIDPipe,
    Query,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('dashboard')
@Controller('dashboard')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) { }

    @Get('store')
    @Roles('ADMIN', 'STORE_ADMIN')
    @ApiOperation({ summary: 'Get Dashboard stats for my store' })
    getStoreStats(@Req() req: any, @Query('storeId') queryStoreId?: string) {
        let storeId = req.user.storeId;
        if (req.user.role === 'ADMIN' && queryStoreId) {
            storeId = queryStoreId;
        }
        if (!storeId) {
            // If Admin and no storeId provided, return empty or global stats?
            // Returning empty object for now.
            return {};
        }
        return this.dashboardService.getStoreStats(storeId);
    }

    @Get('delivery/:id')
    @Roles('ADMIN', 'STORE_ADMIN')
    @ApiOperation({ summary: 'Get Delivery Person stats' })
    getDeliveryStats(@Param('id', ParseUUIDPipe) id: string) {
        return this.dashboardService.getDeliveryStats(id);
    }
}
