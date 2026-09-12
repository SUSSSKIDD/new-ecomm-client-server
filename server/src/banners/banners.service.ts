import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LocalStorageService } from '../common/services/local-storage.service';

export const HOMEPAGE_BANNER_SLOTS = [1, 2, 3] as const;

@Injectable()
export class BannersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localStorage: LocalStorageService,
  ) {}

  private assertValidSlot(slot: number) {
    if (!HOMEPAGE_BANNER_SLOTS.includes(slot as any)) {
      throw new BadRequestException(
        `Invalid slot: ${slot}. Must be one of ${HOMEPAGE_BANNER_SLOTS.join(', ')}`,
      );
    }
  }

  /** Public: active banners for the homepage, ordered by slot. */
  async findActive() {
    return this.prisma.homepageBanner.findMany({
      where: { isActive: true },
      orderBy: { slot: 'asc' },
    });
  }

  /** Admin: all 3 slots (including empty ones), for the management screen. */
  async findAllSlots() {
    const banners = await this.prisma.homepageBanner.findMany({
      orderBy: { slot: 'asc' },
    });
    const bySlot = new Map(banners.map((b) => [b.slot, b]));
    return HOMEPAGE_BANNER_SLOTS.map((slot) => bySlot.get(slot) ?? { slot, imageUrl: null, linkUrl: null, isActive: false });
  }

  async upsert(
    slot: number,
    data: { imageUrl?: string; linkUrl?: string | null },
  ) {
    this.assertValidSlot(slot);
    const existing = await this.prisma.homepageBanner.findUnique({
      where: { slot },
    });

    if (!existing && !data.imageUrl) {
      throw new BadRequestException(
        `Slot ${slot} is empty — an image is required to create it.`,
      );
    }

    // Replacing the image — clean up the old file once the new one is saved.
    if (data.imageUrl && existing?.imageUrl) {
      await this.localStorage.delete(existing.imageUrl);
    }

    return this.prisma.homepageBanner.upsert({
      where: { slot },
      create: {
        slot,
        imageUrl: data.imageUrl!,
        linkUrl: data.linkUrl ?? null,
      },
      update: {
        ...(data.imageUrl && { imageUrl: data.imageUrl }),
        ...(data.linkUrl !== undefined && { linkUrl: data.linkUrl }),
      },
    });
  }

  async remove(slot: number) {
    this.assertValidSlot(slot);
    const existing = await this.prisma.homepageBanner.findUnique({
      where: { slot },
    });
    if (!existing) return { message: 'Slot already empty' };

    await this.localStorage.delete(existing.imageUrl);
    await this.prisma.homepageBanner.delete({ where: { slot } });
    return { message: 'Banner removed' };
  }
}
