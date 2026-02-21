import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all users (admin only)' })
  findAll() {
    return this.usersService.findAll();
  }

  // ── Self-service profile ─────────────────────────────────────────

  @Patch('me/name')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Set your name (one-time only)' })
  updateOwnName(
    @Request() req: { user: { sub: string } },
    @Body('name') name: string,
  ) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      throw new BadRequestException('Name must be at least 2 characters');
    }
    return this.usersService.updateOwnName(req.user.sub, name.trim());
  }

  // ── Addresses (static routes BEFORE parametric :id) ──────────────

  @Get('addresses')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get current user addresses' })
  getAddresses(@Request() req: { user: { sub: string } }) {
    return this.usersService.getAddresses(req.user.sub);
  }

  @Post('addresses')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Create address for current user' })
  createAddress(
    @Request() req: { user: { sub: string } },
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(req.user.sub, dto);
  }

  @Patch('addresses/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Update address' })
  updateAddress(
    @Request() req: { user: { sub: string } },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateAddressDto>,
  ) {
    return this.usersService.updateAddress(req.user.sub, id, dto);
  }

  @Delete('addresses/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Delete address' })
  deleteAddress(
    @Request() req: { user: { sub: string } },
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.deleteAddress(req.user.sub, id);
  }

  // ── User CRUD (parametric :id routes) ────────────────────────────

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get user by ID (admin only)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update user (admin only)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete user (admin only)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.remove(id);
  }
}
