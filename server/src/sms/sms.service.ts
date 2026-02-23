import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { Msg91Service } from './msg91.service';
import { SmsStatus, SmsType } from '@prisma/client';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { SendSmsDto } from './dto/send-sms.dto';
import { SmsQueryDto } from './dto/sms-query.dto';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly msg91: Msg91Service,
  ) { }

  // ── OTP (replaces TwilioService) ──────────────────────────────────

  async sendOtp(phone: string): Promise<void> {
    if (!this.msg91.isReady()) {
      this.logger.warn(
        `[DEV MODE] Skipping actual SMS. Use OTP '123456' for ${phone}`,
      );
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const template = await this.prisma.smsTemplate.findFirst({
      where: { key: 'otp_verification', isActive: true },
    });

    if (!template?.msg91FlowId) {
      throw new BadRequestException(
        'OTP template not configured. Create an SmsTemplate with key "otp_verification" and a msg91FlowId.',
      );
    }

    const requestId = await this.msg91.sendOtp(
      phone,
      otp,
      template.msg91FlowId,
    );

    await this.prisma.smsLog.create({
      data: {
        templateId: template.id,
        recipientPhone: phone,
        variables: { OTP: otp },
        status: SmsStatus.SENT,
        msg91RequestId: requestId,
      },
    });

    this.logger.log(`OTP sent to ${phone}`);
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    // ALWAYS ALLOW DEV BYPASS FOR NOW
    if (code === '123456') {
      this.logger.log(`[DEV MODE BYPASS] OTP verified for ${phone}`);
      return true;
    }

    // DEV MODE (without MSG91 key and code is not 123456)
    if (!this.msg91.isReady()) {
      return false;
    }

    // LIVE — check the most recent OTP sent within the last 10 minutes
    const recentLog = await this.prisma.smsLog.findFirst({
      where: {
        recipientPhone: phone,
        status: SmsStatus.SENT,
        sentAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
      orderBy: { sentAt: 'desc' },
    });

    if (!recentLog?.variables) return false;

    const sentOtp = (recentLog.variables as Record<string, string>).OTP;
    if (sentOtp !== code) return false;

    // Mark log as delivered
    await this.prisma.smsLog.update({
      where: { id: recentLog.id },
      data: { status: SmsStatus.DELIVERED, deliveredAt: new Date() },
    });

    this.logger.log(`OTP verified for ${phone}`);
    return true;
  }

  // ── Template CRUD ─────────────────────────────────────────────────

  async createTemplate(dto: CreateTemplateDto) {
    const variables = this.extractVariables(dto.content);

    return this.prisma.smsTemplate.create({
      data: {
        name: dto.name,
        key: dto.key,
        content: dto.content,
        variables,
        type: dto.type || SmsType.TRANSACTIONAL,
        msg91TemplateId: dto.msg91TemplateId,
        msg91FlowId: dto.msg91FlowId,
      },
    });
  }

  async getAllTemplates() {
    return this.prisma.smsTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTemplateByKey(key: string) {
    const template = await this.prisma.smsTemplate.findUnique({
      where: { key },
    });
    if (!template) {
      throw new NotFoundException(`Template with key '${key}' not found`);
    }
    return template;
  }

  async updateTemplate(id: string, dto: UpdateTemplateDto) {
    const data: Record<string, unknown> = { ...dto };

    if (dto.content) {
      data.variables = this.extractVariables(dto.content);
    }

    return this.prisma.smsTemplate.update({ where: { id }, data });
  }

  // ── Send SMS ──────────────────────────────────────────────────────

  async sendSms(dto: SendSmsDto) {
    const template = await this.getTemplateByKey(dto.templateKey);

    if (!template.msg91FlowId) {
      throw new BadRequestException(
        'Template does not have a MSG91 Flow ID configured',
      );
    }

    // Validate variables
    for (const r of dto.recipients) {
      const missing = template.variables.filter((v) => !(v in r.variables));
      if (missing.length) {
        throw new BadRequestException(
          `Missing variables for ${r.phone}: ${missing.join(', ')}`,
        );
      }
    }

    const requestId = await this.msg91.sendWithTemplate(
      template.msg91FlowId,
      dto.recipients,
    );

    const logs = await Promise.all(
      dto.recipients.map((r) =>
        this.prisma.smsLog.create({
          data: {
            templateId: template.id,
            recipientPhone: r.phone,
            variables: r.variables,
            status: SmsStatus.SENT,
            msg91RequestId: requestId,
          },
        }),
      ),
    );

    return { success: true, requestId, sentCount: logs.length };
  }

  // ── Logs & Analytics ──────────────────────────────────────────────

  async getSmsLogs(query: SmsQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.templateId) where.templateId = query.templateId;
    if (query.recipientPhone)
      where.recipientPhone = { contains: query.recipientPhone };
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      const sentAt: Record<string, Date> = {};
      if (query.startDate) sentAt.gte = new Date(query.startDate);
      if (query.endDate) sentAt.lte = new Date(query.endDate);
      where.sentAt = sentAt;
    }

    const page = query.page || 1;
    const limit = query.limit || 50;

    const [data, total] = await Promise.all([
      this.prisma.smsLog.findMany({
        where,
        include: { template: true },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.smsLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getSmsAnalytics(startDate: Date, endDate: Date) {
    const where = { sentAt: { gte: startDate, lte: endDate } };

    const [total, delivered, failed, pending] = await Promise.all([
      this.prisma.smsLog.count({ where }),
      this.prisma.smsLog.count({
        where: { ...where, status: SmsStatus.DELIVERED },
      }),
      this.prisma.smsLog.count({
        where: { ...where, status: SmsStatus.FAILED },
      }),
      this.prisma.smsLog.count({
        where: { ...where, status: SmsStatus.PENDING },
      }),
    ]);

    return {
      totalSent: total,
      delivered,
      failed,
      pending,
      deliveryRate: total > 0 ? +((delivered / total) * 100).toFixed(2) : 0,
      dateRange: { start: startDate, end: endDate },
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private extractVariables(content: string): string[] {
    const vars: string[] = [];
    const regex = /##([A-Z_]+)##/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      if (!vars.includes(match[1])) vars.push(match[1]);
    }
    return vars;
  }
}
