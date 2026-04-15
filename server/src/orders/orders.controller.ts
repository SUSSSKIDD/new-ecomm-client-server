import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Headers,
  UseGuards,
  Req,
  BadRequestException,
  ParseUUIDPipe,
  HttpCode,
  Patch,
  Sse,
  MessageEvent,
  Res,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { UserSseService } from '../sse/user-sse.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrderStatus } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiHeader,
} from '@nestjs/swagger';
import { Request } from 'express';
import type { Response } from 'express';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  OrderPreviewDto,
} from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { ExportQueryDto } from './dto/export-query.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: string; phone: string; role: string; storeId?: string };
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly userSseService: UserSseService,
  ) { }

  @Sse('sse')
  @ApiOperation({ summary: 'Real-time SSE order status updates for the user' })
  sse(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    const subject = this.userSseService.register(req.user.sub);
    return subject.asObservable().pipe(
      map((payload) => ({ data: payload.data } as MessageEvent)),
    );
  }


  @Post('preview')
  @HttpCode(200)
  @ApiOperation({ summary: 'Preview order with taxes and delivery fee' })
  async preview(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OrderPreviewDto,
  ) {
    return this.ordersService.preview(req.user.sub, dto.addressId, dto.items);
  }

  @Post()
  @ApiOperation({ summary: 'Create order from cart' })
  @ApiHeader({
    name: 'idempotency-key',
    description: 'Unique key to prevent duplicate orders',
    required: true,
  })
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('Idempotency-Key header is required');
    }
    return this.ordersService.create(req.user.sub, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'List user orders (paginated)' })
  async findAll(
    @Req() req: AuthenticatedRequest,
    @Query() query: OrderQueryDto,
  ) {
    return this.ordersService.findAll(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order detail with items' })
  async findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(req.user.sub, id, req.user.role);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel order (only if PENDING/CONFIRMED)' })
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.cancel(req.user.sub, id);
  }

  @Patch(':id/modify')
  @ApiOperation({ summary: 'Modify order items within 90s grace period' })
  async modify(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModifyOrderDto,
  ) {
    return this.ordersService.modifyOrder(req.user.sub, id, dto.items);
  }

  @Get('admin/store')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'List orders for my store (Store Admin)' })
  async findStoreOrders(
    @Req() req: AuthenticatedRequest,
    @Query() query: OrderQueryDto,
  ) {
    if (req.user.role === 'ADMIN') {
      return this.ordersService.findAllAdmin(query);
    }

    const storeId = req.user.storeId;
    if (!storeId) return { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } };
    return this.ordersService.findStoreOrders(storeId, query);
  }

  @Patch('admin/:id/status')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Update order status (Store Admin)' })
  async updateStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: OrderStatus,
  ) {
    return this.ordersService.updateStatus(id, status, req.user.storeId);
  }

  @Post('admin/:id/assign-delivery')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually trigger delivery assignment for an order' })
  async assignDelivery(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.triggerDeliveryAssignment(id, req.user.storeId);
  }

  @Post('admin/:id/manual-assign')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually assign a rider to an order' })
  async manualAssign(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('deliveryPersonId') riderId: string,
  ) {
    return this.ordersService.manualAssignDelivery(id, riderId, req.user.storeId);
  }

  @Get('admin/export/csv')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'STORE_MANAGER')
  @ApiOperation({ summary: 'Export orders and ledger data as CSV' })
  async exportCsv(
    @Req() req: AuthenticatedRequest,
    @Query() query: ExportQueryDto,
    @Res() res: Response,
  ) {
    const csv = await this.ordersService.exportCsv(
      req.user.role,
      req.user.storeId,
      query.startDate,
      query.endDate,
      query.storeId,
    );

    res.header('Content-Type', 'text/csv');
    res.header('Content-Disposition', `attachment; filename="export_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }
}
