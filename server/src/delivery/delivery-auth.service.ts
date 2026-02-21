import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcryptjs';
import { DeliveryLoginDto } from './dto/delivery-login.dto';

@Injectable()
export class DeliveryAuthService {
  private readonly logger = new Logger(DeliveryAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Authenticate a delivery person by phone + PIN.
   * Returns a signed JWT with role: DELIVERY_PERSON.
   */
  async login(dto: DeliveryLoginDto) {
    const person = await this.prisma.deliveryPerson.findUnique({
      where: { phone: dto.phone },
    });

    if (!person || !person.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const pinMatch = await bcrypt.compare(dto.pin, person.pinHash);
    if (!pinMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: person.id,
      phone: person.phone,
      role: 'DELIVERY_PERSON',
    };

    const token = this.jwtService.sign(payload);

    this.logger.log(`Delivery person logged in: ${person.name}`);

    return {
      access_token: token,
      person: {
        id: person.id,
        name: person.name,
        phone: person.phone,
        homeStoreId: person.homeStoreId,
        status: person.status,
      },
    };
  }
}
