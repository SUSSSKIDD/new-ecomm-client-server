import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Req,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateParcelOrderDto } from './dto/create-parcel-order.dto';
import { ApproveParcelDto } from './dto/approve-parcel.dto';
import { UpdateParcelStatusDto } from './dto/update-parcel-status.dto';
import { ParcelQueryDto } from './dto/parcel-query.dto';
import { ParcelService } from './parcel.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
    user: { sub: string; phone: string; role: string };
}

@ApiTags('parcels')
@Controller()
export class ParcelController {
    constructor(private readonly parcelService: ParcelService) { }

    // ── Customer Endpoints ──────────────────────────────────────────

    @Post('parcels')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a parcel order' })
    create(@Req() req: AuthenticatedRequest, @Body() dto: CreateParcelOrderDto) {
        return this.parcelService.create(req.user.sub, dto);
    }

    @Get('parcels')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List user parcel orders' })
    findAllByUser(@Req() req: AuthenticatedRequest, @Query() query: ParcelQueryDto) {
        return this.parcelService.findAllByUser(req.user.sub, query);
    }

    @Get('parcels/:id')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get parcel order detail' })
    findOneByUser(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
        return this.parcelService.findOneByUser(req.user.sub, id);
    }

    @Post('parcels/:id/cancel')
    @UseGuards(AuthGuard('jwt'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cancel a parcel order' })
    cancelByUser(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
        return this.parcelService.cancelByUser(req.user.sub, id);
    }

    // ── Admin Endpoints ──────────────────────────────────────────────

    @Get('admin/parcels')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.PARCEL_MANAGER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List all parcel orders (Admin)' })
    findAllAdmin(@Query() query: ParcelQueryDto) {
        return this.parcelService.findAllAdmin(query);
    }

    @Get('admin/parcels/:id')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.PARCEL_MANAGER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get parcel order detail (Admin)' })
    getOneAdmin(@Param('id', ParseUUIDPipe) id: string) {
        return this.parcelService.getOneAdmin(id);
    }

    @Post('admin/parcels/:id/approve')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.PARCEL_MANAGER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Approve a parcel order' })
    approveParcel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ApproveParcelDto) {
        return this.parcelService.approveParcel(id, dto);
    }

    @Post('admin/parcels/:id/ready')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.PARCEL_MANAGER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Mark parcel ready for pickup' })
    setReadyForPickup(@Param('id', ParseUUIDPipe) id: string) {
        return this.parcelService.setReadyForPickup(id);
    }

    @Patch('admin/parcels/:id/status')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.PARCEL_MANAGER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update parcel status' })
    updateStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateParcelStatusDto) {
        return this.parcelService.updateStatus(id, dto);
    }

    @Post('admin/parcels/:id/assign-delivery')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles(Role.ADMIN, Role.PARCEL_MANAGER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Trigger delivery assignment for parcel' })
    triggerDeliveryAssignment(@Param('id', ParseUUIDPipe) id: string) {
        return this.parcelService.triggerDeliveryAssignment(id);
    }
}
