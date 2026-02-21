import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { TwilioService } from './twilio.service';
import { SendOtpDto, VerifyOtpDto, StoreAdminLoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private twilioService: TwilioService,
  ) { }

  async sendOtp(dto: SendOtpDto) {
    // TODO: Add rate limiting here using Redis
    try {
      await this.twilioService.sendOtp(dto.phone);
      return { message: 'OTP sent successfully' };
    } catch (error) {
      throw new BadRequestException(
        'Failed to send OTP. Please try again later.',
      );
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const isValid = await this.twilioService.verifyOtp(dto.phone, dto.otp);

    if (!isValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Find or create user
    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user) {
      const role = dto.phone === '+919999999999' ? Role.ADMIN : Role.USER;
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          role,
        },
      });
      this.logger.log(`New user created: ${user.id}`);
    } else if (
      dto.phone === '+919999999999' &&
      user.role !== Role.ADMIN
    ) {
      // Promote to ADMIN if previously created as USER (e.g. during failed tests)
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { role: Role.ADMIN },
      });
      this.logger.log(`Promoted user ${user.id} to ADMIN`);
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
  async storeAdminLogin(dto: StoreAdminLoginDto) {
    const admin = await this.prisma.storeAdmin.findUnique({
      where: { phone: dto.phone },
      include: { store: true },
    });

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const isPinValid = await bcrypt.compare(dto.pin, admin.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: admin.id,
      phone: admin.phone,
      role: Role.STORE_ADMIN,
      storeId: admin.storeId,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: admin.id,
        name: admin.name,
        phone: admin.phone,
        role: Role.STORE_ADMIN,
        storeId: admin.storeId,
        storeName: admin.store.name,
        storeCode: admin.store.storeCode,
      },
    };
  }
}
