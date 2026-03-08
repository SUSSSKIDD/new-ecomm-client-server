import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrintService } from './print.service';
import { CreatePrintProductDto, UpdatePrintProductDto } from './dto/print-product.dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('print-products')
@Controller('print-products')
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  // ── Public ──────────────────────────────────────────────────

  @Get('active')
  @ApiOperation({ summary: 'List active print products (public)' })
  findActive() {
    return this.printService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a print product by ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.printService.findOne(id);
  }

  // ── Admin ───────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all print products (Admin)' })
  findAll() {
    return this.printService.findAll();
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a print product (Admin)' })
  create(@Body() dto: CreatePrintProductDto) {
    return this.printService.create(dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update a print product (Admin)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePrintProductDto,
  ) {
    return this.printService.update(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Deactivate a print product (Admin)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.printService.remove(id);
  }

  @Patch(':id/activate')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reactivate a print product (Admin)' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.printService.activate(id);
  }
}
