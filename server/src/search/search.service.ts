import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisCacheService } from '../common/services/redis-cache.service';
import {
  SearchProductsDto,
  SearchSuggestionsDto,
  SortBy,
} from './dto/search-query.dto';
import {
  SearchProductsResponse,
  SearchSuggestionsResponse,
  CategoriesResponse,
  ProductListItem,
} from './dto/search-response.dto';
import { Prisma } from '@prisma/client';

interface CursorPayload {
  score?: number;
  id?: string;
  createdAt?: string;
}

interface RawProductRow {
  id: string;
  name: string;
  price: number;
  mrp: number | null;
  category: string;
  subCategory: string | null;
  stock: number;
  isGrocery: boolean;
  images: string[] | null;
  createdAt: Date;
  relevance_score?: string;
}

interface RawSuggestionRow {
  id: string;
  name: string;
  category: string;
}

type ProductListRow = Prisma.ProductGetPayload<{
  select: typeof PRODUCT_LIST_SELECT;
}>;

const PRODUCT_LIST_SELECT = {
  id: true,
  name: true,
  price: true,
  mrp: true,
  category: true,
  subCategory: true,
  stock: true,
  isGrocery: true,
  images: true,
  createdAt: true,
} satisfies Prisma.ProductSelect;

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: RedisCacheService,
  ) {}

  async searchProducts(
    dto: SearchProductsDto,
  ): Promise<SearchProductsResponse> {
    const {
      q,
      category,
      subCategory,
      isGrocery,
      inStock = true,
      sortBy = SortBy.RELEVANCE,
      limit = 20,
      cursor,
      page,
    } = dto;

    const cacheKey = `search:${q ?? ''}|${category ?? ''}|${subCategory ?? ''}|${isGrocery ?? ''}|${inStock}|${sortBy}|${limit}|${cursor ?? ''}|${page ?? ''}`;
    const cached = await this.cache.get<SearchProductsResponse>(cacheKey);
    if (cached) return cached;

    // Fallback: If sorting by RELEVANCE but we use simple search, map to NEWEST or NAME
    // Since we don't have searchVector anymore, we can't do true relevance scoring.
    const effectiveSortForPrisma =
      sortBy === SortBy.RELEVANCE ? SortBy.NEWEST : sortBy;

    // Always use filteredSearch (Prisma-based)
    return this.filteredSearch(
      { ...dto, sortBy: effectiveSortForPrisma },
      cacheKey,
    );
  }

  // ── Full-Text Search REMOVED (searchVector column missing) ──────

  // ── Filtered Browse (Prisma-based) ───────────────────────────────
  private async filteredSearch(
    dto: SearchProductsDto,
    cacheKey: string,
  ): Promise<SearchProductsResponse> {
    const {
      q,
      category,
      subCategory,
      isGrocery,
      inStock = true,
      sortBy = SortBy.NEWEST,
      limit = 20,
      cursor,
      page,
    } = dto;

    const where: Prisma.ProductWhereInput = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { category: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } }, // Added description
      ];
    }
    if (category) where.category = { equals: category, mode: 'insensitive' };
    if (subCategory)
      where.subCategory = { equals: subCategory, mode: 'insensitive' };
    if (isGrocery !== undefined) where.isGrocery = isGrocery;
    if (inStock) where.stock = { gt: 0 };

    const orderBy = this.buildOrderBy(sortBy);

    // ── Cursor-based pagination (mobile / infinite scroll) ──
    if (cursor) {
      const decoded = this.decodeCursor(cursor);
      const fetchLimit = limit + 1;

      const cursorCondition: Prisma.ProductWhereInput = decoded.createdAt && decoded.id
        ? {
            OR: [
              { createdAt: { lt: new Date(decoded.createdAt) } },
              {
                createdAt: new Date(decoded.createdAt),
                id: { lt: decoded.id },
              },
            ],
          }
        : {};
      const cursorWhere: Prisma.ProductWhereInput = {
        AND: [where, cursorCondition],
      };

      const results = await this.prisma.product.findMany({
        where: cursorWhere,
        select: PRODUCT_LIST_SELECT,
        orderBy,
        take: fetchLimit,
      });

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const data = items.map(this.toListItem);

      const lastItem = items[items.length - 1];
      const nextCursor =
        hasMore && lastItem
          ? this.encodeCursor({
              createdAt: lastItem.createdAt.toISOString(),
              id: lastItem.id,
            })
          : null;

      const response: SearchProductsResponse = {
        data,
        cursor: { next: nextCursor },
        meta: { hasMore },
      };
      await this.cache.set(cacheKey, response, 120);
      return response;
    }

    // ── Offset-based pagination (desktop) ──
    const pageNum = page ?? 1;
    const skip = (pageNum - 1) * limit;

    const [results, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: PRODUCT_LIST_SELECT,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    const data = results.map(this.toListItem);
    const totalPages = Math.ceil(total / limit);

    const response: SearchProductsResponse = {
      data,
      cursor: { next: null },
      meta: { hasMore: pageNum < totalPages, total, page: pageNum, totalPages },
    };

    await this.cache.set(cacheKey, response, 120);
    return response;
  }

  // ── Suggestions (Prisma-based) ───────────────────────────────────
  async getSuggestions(
    dto: SearchSuggestionsDto,
  ): Promise<SearchSuggestionsResponse> {
    const { q, limit = 6 } = dto;
    const cacheKey = `suggestions:${q.toLowerCase()}:${limit}`;

    const cached = await this.cache.get<SearchSuggestionsResponse>(cacheKey);
    if (cached) return cached;

    if (!q || q.length < 1) {
      return { suggestions: [] };
    }

    const results = await this.prisma.product.findMany({
      where: {
        AND: [
          { stock: { gt: 0 } },
          {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: { id: true, name: true, category: true },
      take: limit,
      orderBy: { createdAt: 'desc' }, // Simple ordering
    });

    const response: SearchSuggestionsResponse = {
      suggestions: results.map((r) => ({
        id: r.id,
        name: r.name,
        category: r.category,
      })),
    };

    await this.cache.set(cacheKey, response, 60);
    return response;
  }

  // ── Categories with counts ───────────────────────────────────────
  async getCategories(): Promise<CategoriesResponse> {
    const cacheKey = 'categories:all';
    const cached = await this.cache.get<CategoriesResponse>(cacheKey);
    if (cached) return cached;

    const results = await this.prisma.product.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { stock: { gt: 0 } },
      orderBy: { _count: { id: 'desc' } },
    });

    const response: CategoriesResponse = {
      categories: results.map((r) => ({
        category: r.category,
        count: r._count.id,
      })),
    };

    await this.cache.set(cacheKey, response, 300);
    return response;
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private toListItem(product: ProductListRow): ProductListItem {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp ?? null,
      category: product.category,
      subCategory: product.subCategory ?? null,
      stock: product.stock,
      isGrocery: product.isGrocery,
      image: product.images?.[0] ?? null,
    };
  }

  private buildOrderBy(
    sortBy: SortBy,
  ): Prisma.ProductOrderByWithRelationInput[] {
    switch (sortBy) {
      case SortBy.PRICE_ASC:
        return [{ price: 'asc' }, { id: 'desc' }];
      case SortBy.PRICE_DESC:
        return [{ price: 'desc' }, { id: 'desc' }];
      case SortBy.NAME:
        return [{ name: 'asc' }, { id: 'desc' }];
      case SortBy.NEWEST:
      default:
        return [{ createdAt: 'desc' }, { id: 'desc' }];
    }
  }

  private encodeCursor(payload: CursorPayload): string {
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeCursor(cursor: string): CursorPayload {
    try {
      return JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as CursorPayload;
    } catch {
      return {};
    }
  }
}
