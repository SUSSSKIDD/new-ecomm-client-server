import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreatePrintProductDto, UpdatePrintProductDto } from './dto/print-product.dto';

@Injectable()
export class PrintService {
  private readonly logger = new Logger(PrintService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePrintProductDto) {
    const product = await this.prisma.printProduct.create({
      data: {
        name: dto.name,
        productType: dto.productType,
        sizes: dto.sizes as any,
        basePrice: dto.basePrice,
        image: dto.image ?? null,
      },
    });
    this.logger.log(`Print product created: ${product.name} (${product.productType})`);
    return product;
  }

  async findAll() {
    return this.prisma.printProduct.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive() {
    return this.prisma.printProduct.findMany({
      where: { isActive: true },
      orderBy: { productType: 'asc' },
    });
  }

  async findOne(id: string) {
    const product = await this.prisma.printProduct.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Print product ${id} not found`);
    return product;
  }

  async update(id: string, dto: UpdatePrintProductDto) {
    await this.findOne(id);
    const updated = await this.prisma.printProduct.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.productType !== undefined && { productType: dto.productType }),
        ...(dto.sizes !== undefined && { sizes: dto.sizes as any }),
        ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
        ...(dto.image !== undefined && { image: dto.image }),
      },
    });
    this.logger.log(`Print product updated: ${updated.name}`);
    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.printProduct.update({
      where: { id },
      data: { isActive: false },
    });
    this.logger.log(`Print product deactivated: ${id}`);
    return { message: 'Print product deactivated', id };
  }

  async activate(id: string) {
    await this.findOne(id);
    await this.prisma.printProduct.update({
      where: { id },
      data: { isActive: true },
    });
    this.logger.log(`Print product activated: ${id}`);
    return { message: 'Print product activated', id };
  }
}
