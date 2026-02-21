import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { SmsService } from './sms.service';
import { CreateTemplateDto, UpdateTemplateDto, SendSmsDto, SmsQueryDto } from './dto';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('sms')
@Controller('sms')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  // ── Templates ─────────────────────────────────────────────────────

  @Post('templates')
  @ApiOperation({ summary: 'Create SMS template' })
  createTemplate(@Body() dto: CreateTemplateDto) {
    return this.smsService.createTemplate(dto);
  }

  @Get('templates')
  @ApiOperation({ summary: 'List all SMS templates' })
  getAllTemplates() {
    return this.smsService.getAllTemplates();
  }

  @Get('templates/:key')
  @ApiOperation({ summary: 'Get SMS template by key' })
  getTemplateByKey(@Param('key') key: string) {
    return this.smsService.getTemplateByKey(key);
  }

  @Put('templates/:id')
  @ApiOperation({ summary: 'Update SMS template' })
  updateTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.smsService.updateTemplate(id, dto);
  }

  // ── Send ──────────────────────────────────────────────────────────

  @Post('send')
  @ApiOperation({ summary: 'Send SMS using a template' })
  sendSms(@Body() dto: SendSmsDto) {
    return this.smsService.sendSms(dto);
  }

  // ── Logs & Analytics ──────────────────────────────────────────────

  @Get('logs')
  @ApiOperation({ summary: 'Get SMS logs (paginated)' })
  getSmsLogs(@Query() query: SmsQueryDto) {
    return this.smsService.getSmsLogs(query);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get SMS analytics for date range' })
  getSmsAnalytics(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.smsService.getSmsAnalytics(
      new Date(startDate),
      new Date(endDate),
    );
  }
}
