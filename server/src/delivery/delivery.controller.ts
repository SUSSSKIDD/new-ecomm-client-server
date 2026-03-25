import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Sse,
  UseGuards,
  ParseUUIDPipe,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { DeliveryService } from './delivery.service';
import { DeliverySseService } from '../sse/delivery-sse.service';
import { AutoAssignService } from './auto-assign.service';
import { OrderClaimService } from './order-claim.service';
import { OrderPoolService } from './order-pool.service';
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
  private readonly logger = new Logger(DeliveryController.name);

  constructor(
    private readonly deliveryService: DeliveryService,
    private readonly sseService: DeliverySseService,
    private readonly autoAssignService: AutoAssignService,
    private readonly orderClaimService: OrderClaimService,
    private readonly orderPoolService: OrderPoolService,
  ) { }

  /** Broadcast all pending orders + parcels to a FREE rider (fire-and-forget). */
  private broadcastPendingToRider(riderId: string): void {
    this.autoAssignService
      .checkPendingOrders(riderId)
      .catch((err) => this.logger.error(`checkPendingOrders error: ${err.message}`));
    this.autoAssignService
      .checkPendingParcelOrders(riderId)
      .catch((err) => this.logger.error(`checkPendingParcelOrders error: ${err.message}`));
  }

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
    data: Partial<{ name: string; isActive: boolean; pin: string }>,
  ) {
    return this.deliveryService.updatePerson(id, data);
  }

  @Delete('persons/:id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete delivery person' })
  deletePerson(@Param('id', ParseUUIDPipe) id: string) {
    return this.deliveryService.deletePerson(id);
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

    if (dto.status === DeliveryPersonStatus.FREE) {
      this.broadcastPendingToRider(req.user.sub);
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

  @Get('parcel-orders')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'List assigned parcels' })
  getAssignedParcelOrders(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getAssignedParcelOrders(req.user.sub);
  }

  @Get('history')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Get delivery history (completed orders + parcels)' })
  getDeliveryHistory(@Req() req: AuthenticatedRequest) {
    return this.deliveryService.getDeliveryHistory(req.user.sub);
  }

  // ── Competitive Claiming ──────────────────────────────────────

  @Get('available-orders')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'List available orders for claiming (SSE reconnection fallback)' })
  getAvailableOrders(@Req() req: AuthenticatedRequest) {
    return this.orderPoolService.getAvailableOrdersForRider(req.user.sub);
  }

  @Post('orders/:id/claim')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Competitively claim an available order' })
  claimOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orderClaimService.claimOrder(req.user.sub, id);
  }

  @Post('orders/:id/accept')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Accept a delivery assignment' })
  acceptAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveryService.acceptAssignment(req.user.sub, id);
  }

  @Post('orders/:id/reject')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Reject a delivery assignment' })
  async rejectAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const response = await this.deliveryService.rejectAssignment(req.user.sub, id);

    // Re-broadcast for other riders to claim
    this.autoAssignService
      .assignOrder(id)
      .catch((err) => this.logger.error(`Re-assign after reject error: ${err.message}`));

    return response;
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
      dto.deliveryPin,
      dto.reason,
    );

    this.broadcastPendingToRider(req.user.sub);

    return response;
  }

  @Post('parcels/:id/claim')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Competitively claim an available parcel' })
  claimParcelOrder(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.orderClaimService.claimParcelOrder(req.user.sub, id);
  }

  @Post('parcels/:id/accept')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Accept a parcel assignment' })
  acceptParcelAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.deliveryService.acceptParcelAssignment(req.user.sub, id);
  }

  @Post('parcels/:id/reject')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Reject a parcel assignment' })
  async rejectParcelAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const response = await this.deliveryService.rejectParcelAssignment(req.user.sub, id);

    // Broadcast back to pool
    this.orderPoolService.broadcastParcelOrder(id)
      .catch(err => this.logger.error(`Re-broadcast parcel after reject error: ${err.message}`));

    return response;
  }

  @Post('parcels/:id/complete')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('DELIVERY_PERSON')
  @ApiOperation({ summary: 'Mark parcel as DELIVERED or NOT_DELIVERED' })
  async completeParcelDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteDeliveryDto,
  ) {
    const response = await this.deliveryService.completeParcelDelivery(
      req.user.sub,
      id,
      dto.result,
      dto.deliveryPin,
      dto.reason,
    );

    this.broadcastPendingToRider(req.user.sub);

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

    // Push currently available pool orders to connecting rider immediately
    this.orderPoolService
      .getAvailableOrdersForRider(req.user.sub)
      .then((snapshots) => {
        for (const snap of snapshots) {
          this.sseService.notify(req.user.sub, {
            type: 'NEW_AVAILABLE_ORDER',
            data: snap,
          });
        }
      })
      .catch((err) =>
        this.logger.error(`Initial SSE push error: ${err.message}`),
      );

    // Cleanup on disconnect or error (e.g. network drop)
    const cleanup = () => this.sseService.unregister(req.user.sub);
    req.on('close', cleanup);
    req.on('error', cleanup);

    return subject.asObservable();
  }
}
