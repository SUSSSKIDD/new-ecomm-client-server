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
} from '@nestjs/common';
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
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { ModifyOrderDto } from './dto/modify-order.dto';

interface AuthenticatedRequest extends Request {
  user: { sub: string; phone: string; role: string };
}

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) { }

  @Post('preview')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Preview order from current cart. Pass { addressId } in body for fulfillment-aware preview.',
  })
  async preview(
    @Req() req: AuthenticatedRequest,
    @Body('addressId') addressId?: string,
  ) {
    return this.ordersService.preview(req.user.sub, addressId);
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
    const user = req.user as any;
    const storeId = user.storeId;

    if (user.role === 'ADMIN') {
      // Super admin sees all orders? Or reuse findAll?
      // Let's reuse findAll logic but without userId filter?
      // Currently findAll filters by userId.
      // We need a generic findAll.
      return this.ordersService.findAllAdmin(query);
    }

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
    const user = req.user as any;
    return this.ordersService.updateStatus(id, status, user.storeId);
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
    const user = req.user as any;
    return this.ordersService.triggerDeliveryAssignment(id, user.storeId);
  }
}
