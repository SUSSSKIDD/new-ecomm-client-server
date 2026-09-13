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
    return HOMEPAGE_BANNER_SLOTS.map((slot) => bySlot.get(slot) ?? { slot, imageUrl: null, linkUrl: null, badgeText: null, heading: null, subheading: null, isActive: false });
  }

  async upsert(
    slot: number,
    data: {
      imageUrl?: string;
      linkUrl?: string | null;
      badgeText?: string | null;
      heading?: string | null;
      subheading?: string | null;
    },
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

    // Deliberately not using prisma.homepageBanner.upsert() here — Prisma
    // validates the full `create` argument shape (including the required
    // imageUrl field) up front regardless of whether `update` is what will
    // actually run, so a text-only edit of an existing banner (imageUrl
    // undefined) would always fail that check even though create is never
    // reached. Branching explicitly avoids that.
    if (existing) {
      return this.prisma.homepageBanner.update({
        where: { slot },
        data: {
          ...(data.imageUrl && { imageUrl: data.imageUrl }),
          ...(data.linkUrl !== undefined && { linkUrl: data.linkUrl }),
          ...(data.badgeText !== undefined && { badgeText: data.badgeText }),
          ...(data.heading !== undefined && { heading: data.heading }),
          ...(data.subheading !== undefined && { subheading: data.subheading }),
        },
      });
    }

    return this.prisma.homepageBanner.create({
      data: {
        slot,
        imageUrl: data.imageUrl!, // guaranteed present — guard above rejects the alternative
        linkUrl: data.linkUrl ?? null,
        badgeText: data.badgeText ?? null,
        heading: data.heading ?? null,
        subheading: data.subheading ?? null,
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
