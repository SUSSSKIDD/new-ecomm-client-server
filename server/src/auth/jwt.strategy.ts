import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

export interface JwtPayload {
  sub: string;
  phone: string;
  role: string;
  storeId?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req) => {
        let token = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
        if (!token && req.query && typeof req.query.token === 'string') {
          token = req.query.token;
        }
        return token;
      },
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // DB check: handle revocation for store managers and delivery persons
    if (payload.role === 'STORE_MANAGER') {
      const manager = await this.prisma.storeManager.findUnique({
        where: { id: payload.sub },
        select: { isActive: true },
      });
      if (!manager || !manager.isActive) {
        throw new UnauthorizedException('Account deactivated');
      }
    } else if (payload.role === 'DELIVERY_PERSON') {
      const dp = await this.prisma.deliveryPerson.findUnique({
        where: { id: payload.sub },
        select: { isActive: true },
      });
      if (!dp || !dp.isActive) {
        throw new UnauthorizedException('Account deactivated');
      }
    } else if (payload.role === 'PARCEL_MANAGER') {
      const pm = await this.prisma.parcelManager.findUnique({
        where: { id: payload.sub },
        select: { isActive: true },
      });
      if (!pm || !pm.isActive) {
        throw new UnauthorizedException('Account deactivated');
      }
    } else {
      // USER or ADMIN — verify user exists and use fresh role from DB
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { role: true },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      return {
        sub: payload.sub,
        phone: payload.phone,
        role: user.role,
        storeId: payload.storeId,
      };
    }

    return {
      sub: payload.sub,
      phone: payload.phone,
      role: payload.role,
      storeId: payload.storeId,
    };
  }
}
