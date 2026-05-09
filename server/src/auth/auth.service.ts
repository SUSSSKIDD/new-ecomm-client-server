import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { SmsService } from '../sms/sms.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import { SendOtpDto, VerifyOtpDto, StoreManagerLoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { TTL } from '../common/redis/ttl.config.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly superAdminPhone: string;
  private readonly superAdminPinHash: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private smsService: SmsService,
    private config: ConfigService,
    private cache: RedisCacheService,
  ) {
    let phoneParam = this.config.get<string>('SUPER_ADMIN_PHONE', '');
    this.superAdminPhone = phoneParam.replace(/^["']|["']$/g, '');
    
    let pinParam = this.config.get<string>('SUPER_ADMIN_PIN', '');
    const cleanPin = pinParam.replace(/^["']|["']$/g, '');
    // Pre-hash the pin synchronously at startup for comparison later
    this.superAdminPinHash = cleanPin ? bcrypt.hashSync(cleanPin, 10) : '';
  }

  async sendOtp(dto: SendOtpDto) {
    // Fixed OTP for testing
    const testNumbers = ['+919999999999', '+918888888888'];
    if (testNumbers.includes(dto.phone)) {
      return { message: 'OTP sent successfully (Test Mode)' };
    }

    // Rate limit: max 5 OTP requests per phone per 15 minutes
    const rlKey = `otp:rl:${dto.phone}`;
    const count = await this.cache.incr(rlKey, TTL.OTP_RATE_LIMIT);
    if (count > 5) {
      throw new BadRequestException('Too many OTP requests. Try again later.');
    }

    try {
      await this.smsService.sendOtp(dto.phone);
      return { message: 'OTP sent successfully' };
    } catch (error) {
      this.logger.error(`OTP Sending failed: ${error.message}`, error.stack);
      throw new BadRequestException(
        error.message || 'Failed to send OTP. Please try again later.',
      );
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const testNumbers = ['+919999999999', '+918888888888'];
    let isValid = false;

    if (testNumbers.includes(dto.phone) && dto.otp === '123456') {
      isValid = true;
    } else {
      isValid = await this.smsService.verifyOtp(dto.phone, dto.otp);
    }

    if (!isValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          role: Role.USER,
        },
      });
      this.logger.log(`New user created: ${user.id}`);
    }

    const payload = { sub: user.id, phone: user.phone, role: user.role };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
      },
    };
  }
  async storeManagerLogin(dto: StoreManagerLoginDto) {
    const manager = await this.prisma.storeManager.findUnique({
      where: { phone: dto.phone },
      include: { store: true },
    });

    if (!manager || !manager.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const rlKey = `pin:rl:store:${dto.phone}`;
    const attempts = await this.cache.incr(rlKey, 300);
    if (attempts > 5) {
      throw new UnauthorizedException('Too many failed attempts. Lockout for 5 minutes.');
    }

    const isPinValid = await bcrypt.compare(dto.pin, manager.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.cache.del(rlKey);

    const payload = {
      sub: manager.id,
      phone: manager.phone,
      role: Role.STORE_MANAGER,
      storeId: manager.storeId,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: manager.id,
        name: manager.name,
        phone: manager.phone,
        role: Role.STORE_MANAGER,
        storeId: manager.storeId,
        storeName: manager.store.name,
        storeCode: manager.store.storeCode,
        storeType: manager.store.storeType,
      },
    };
  }

  async superAdminLogin(dto: StoreManagerLoginDto) {
    if (!this.superAdminPhone || !this.superAdminPinHash) {
      throw new UnauthorizedException('Super Admin not configured');
    }

    if (dto.phone !== this.superAdminPhone) {
      throw new UnauthorizedException('Invalid Super Admin credentials');
    }

    const rlKey = `pin:rl:superadmin:${dto.phone}`;
    const attempts = await this.cache.incr(rlKey, 300);
    if (attempts > 5) {
      throw new UnauthorizedException('Too many failed attempts. Lockout for 5 minutes.');
    }

    const isPinValid = await bcrypt.compare(dto.pin, this.superAdminPinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid Super Admin credentials');
    }

    await this.cache.del(rlKey);

    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          role: Role.ADMIN,
          name: 'Super Admin',
        },
      });
    } else if (user.role !== Role.ADMIN) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN },
      });
    }

    const payload = {
      sub: user.id,
      phone: user.phone,
      role: Role.ADMIN,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: Role.ADMIN,
      },
    };
  }

  async parcelManagerLogin(dto: StoreManagerLoginDto) {
    const manager = await this.prisma.parcelManager.findUnique({
      where: { phone: dto.phone },
    });

    if (!manager || !manager.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const rlKey = `pin:rl:parcel:${dto.phone}`;
    const attempts = await this.cache.incr(rlKey, 300);
    if (attempts > 5) {
      throw new UnauthorizedException('Too many failed attempts. Lockout for 5 minutes.');
    }

    const isPinValid = await bcrypt.compare(dto.pin, manager.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.cache.del(rlKey);

    const payload = {
      sub: manager.id,
      phone: manager.phone,
      role: Role.PARCEL_MANAGER,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: manager.id,
        name: manager.name,
        phone: manager.phone,
        role: Role.PARCEL_MANAGER,
      },
    };
  }
}
