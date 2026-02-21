import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateAddressDto } from './dto/create-address.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        phone: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { addresses: true },
    });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    await this.prisma.user.delete({ where: { id } });
    return { message: 'User deleted' };
  }

  // ── Self-service profile update (name can only be set once) ─────

  async updateOwnName(userId: string, name: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.name) {
      throw new ForbiddenException('Name has already been set and cannot be changed');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
      select: { id: true, phone: true, name: true, role: true },
    });
  }

  // ── Addresses ────────────────────────────────────────────────────

  async getAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.address.create({
      data: { userId, ...dto },
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: Partial<CreateAddressDto>,
  ) {
    const address = await this.findOwnedAddress(userId, addressId);
    return this.prisma.address.update({
      where: { id: address.id },
      data: dto,
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.findOwnedAddress(userId, addressId);
    await this.prisma.address.delete({ where: { id: address.id } });
    return { message: 'Address deleted' };
  }

  private async findOwnedAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('Not authorized to modify this address');
    }
    return address;
  }
}
