import { Controller, Get, Res, Header } from '@nestjs/common';
import { SitemapService } from './sitemap.service';
import type { Response } from 'express';

@Controller()
export class SitemapController {
  constructor(private sitemapService: SitemapService) {}

  @Get('sitemap.xml')
  @Header('Content-Type', 'application/xml')
  async sitemap(@Res() res: Response) {
    const xml = await this.sitemapService.generateSitemap();
    res.send(xml);
  }

  @Get('robots.txt')
  @Header('Content-Type', 'text/plain')
  robots() {
    return `User-agent: *
Allow: /

# Sitemap
Sitemap: https://neyokart.com/sitemap.xml

# Disallow admin, auth, api routes
Disallow: /admin/
Disallow: /delivery/
Disallow: /api/
Disallow: /cart
Disallow: /login
Disallow: *?page=
Disallow: *?sort=
Disallow: *?filter=
Disallow: *?search=
Disallow: /profile
Disallow: /orders
Disallow: /checkout
`;
  }
}