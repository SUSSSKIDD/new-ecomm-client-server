import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  Sse,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { DeliveryService } from './delivery.service';
import { DeliverySseService } from './delivery-sse.service';
import { AutoAssignService } from './auto-assign.service';
import { CreateDeliveryPersonDto } from './dto/create-delivery-person.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CompleteDeliveryDto } from './dto/complete-delivery.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DeliveryPersonStatus } from '@prisma/client';

interface AuthenticatedRequest extends Request {
  user: { sub: string; phone: string; role: string };
}

@ApiTags('delivery')
@Controller('delivery')
export class DeliveryController {
  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly sseService: DeliverySseService,
    private readonly autoAssignService: AutoAssignService,
  ) {}

  // ── Admin endpoints ─────────────────────────────────────────────

  @Post('persons')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create delivery person (returns PIN once)' })
  createPerson(@Body() dto: CreateDeliveryPersonDto) {
    return this.deliveryService.createPerson(dto);
  }

  @Get('persons')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all delivery persons' })
  findAllPersons() {
    return this.deliveryService.findAllPersons();
  }

  @Patch('persons/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update delivery person' })
  updatePerson(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    data: Partial<{ name: string; isActive: boolean; homeStoreId: string }>,
  ) {
    return this.deliveryService.updatePerson(id, data);
  }

  // ── Delivery person self-service ────────────────────────────────

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Get own profile' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getProfile(req.user.sub);
  }

  @Post('location')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Update GPS location' })
  updateLocation(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.deliveryService.updateLocation(req.user.sub, dto.lat, dto.lng);
  }

  @Post('status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Set FREE/BUSY status' })
  async setStatus(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateStatusDto,
  ) {
    const result = await this.deliveryService.setStatus(
      req.user.sub,
      dto.status,
    );

    // If person sets FREE, check for pending orders
    if (dto.status === DeliveryPersonStatus.FREE) {
      // Fire-and-forget (non-blocking)
      this.autoAssignService
        .checkPendingOrders(req.user.sub)
        .catch((err) =>
          console.error('checkPendingOrders error:', err.message),
        );
    }

    return result;
  }

  @Get('orders')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'List assigned orders' })
  getOrders(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getAssignedOrders(req.user.sub);
  }

  @Post('orders/:id/complete')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Mark delivery as DELIVERED or NOT_DELIVERED' })
  async completeDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteDeliveryDto,
  ) {
    const response = await this.deliveryService.completeDelivery(
      req.user.sub,
      id,
      dto.result,
    );

    // Person is now FREE — check pending orders
    this.autoAssignService
      .checkPendingOrders(req.user.sub)
      .catch((err) => console.error('checkPendingOrders error:', err.message));

    return response;
  }

  // ── SSE Stream ──────────────────────────────────────────────────

  @Sse('sse')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'SSE stream for real-time notifications' })
  sse(@Req() req: AuthenticatedRequest): Observable<{ data: string }> {
    const subject = this.sseService.register(req.user.sub);

    // Cleanup on disconnect
    req.on('close', () => {
      this.sseService.unregister(req.user.sub);
    });

    return subject.asObservable();
  }
}
