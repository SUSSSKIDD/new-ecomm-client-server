import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { SmsService } from '../sms/sms.service';
import { SendOtpDto, VerifyOtpDto, StoreManagerLoginDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private smsService: SmsService,
  ) { }

  async sendOtp(dto: SendOtpDto) {
    // TODO: Add rate limiting here using Redis
    try {
      await this.smsService.sendOtp(dto.phone);
      return { message: 'OTP sent successfully' };
    } catch (error) {
      throw new BadRequestException(
        'Failed to send OTP. Please try again later.',
      );
    }
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const isValid = await this.smsService.verifyOtp(dto.phone, dto.otp);

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
  async storeManagerLogin(dto: StoreManagerLoginDto) {
    const manager = await this.prisma.storeManager.findUnique({
      where: { phone: dto.phone },
      include: { store: true },
    });

    if (!manager || !manager.isActive) {
      throw new UnauthorizedException('Invalid credentials or inactive account');
    }

    const isPinValid = await bcrypt.compare(dto.pin, manager.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

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
    if (dto.phone !== '+919999999999' || dto.pin !== '0000') {
      throw new UnauthorizedException('Invalid Super Admin credentials');
    }

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
}
