import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SitemapService {
  constructor(private prisma: PrismaService) {}

  async generateSitemap(): Promise<string> {
    const baseUrl = 'https://neyokart.com';
    const urls: Array<{
      url: string;
      lastmod?: string;
      changefreq: string;
      priority: number;
    }> = [
      { url: baseUrl, changefreq: 'daily', priority: 1.0 },
      { url: `${baseUrl}/legal`, changefreq: 'monthly', priority: 0.8 },
      { url: `${baseUrl}/pickup-drop`, changefreq: 'weekly', priority: 0.7 },
    ];

    // Add category pages for GROCERY
    const groceryCategories = await this.prisma.categoryConfig.findMany({
      where: { storeType: 'GROCERY' },
      select: { subcategory: true },
      distinct: ['subcategory'],
    });

    for (const cat of groceryCategories) {
      urls.push({
        url: `${baseUrl}/category/Grocery/${encodeURIComponent(cat.subcategory)}`,
        changefreq: 'daily',
        priority: 0.9,
      });
    }

    // Add category pages for other store types
    const otherStoreTypes = ['PIZZA_TOWN', 'DROP_IN_FACTORY'];
    for (const storeType of otherStoreTypes) {
      const categories = await this.prisma.categoryConfig.findMany({
        where: { storeType },
        select: { subcategory: true },
        distinct: ['subcategory'],
      });

      const label =
        storeType === 'PIZZA_TOWN'
          ? 'Pizza%20Town%20%26%20Food%20Zone'
          : 'Print%20Factory';

      for (const cat of categories) {
        urls.push({
          url: `${baseUrl}/category/${label}/${encodeURIComponent(cat.subcategory)}`,
          changefreq: 'daily',
          priority: 0.8,
        });
      }
    }

    // Add product pages (limit to 5000 for crawl budget)
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, updatedAt: true },
      take: 5000,
      orderBy: { updatedAt: 'desc' },
    });

    for (const product of products) {
      urls.push({
        url: `${baseUrl}/product/${product.id}`,
        lastmod: product.updatedAt.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: 0.8,
      });
    }

    return this.buildXml(urls);
  }

  private buildXml(
    urls: Array<{
      url: string;
      lastmod?: string;
      changefreq: string;
      priority: number;
    }>,
  ): string {
    const urlElements = urls
      .map(
        (u) => `
      <url>
        <loc>${u.url}</loc>
        ${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}
        <changefreq>${u.changefreq}</changefreq>
        <priority>${u.priority}</priority>
      </url>
    `,
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urlElements}
</urlset>`;
  }
}
