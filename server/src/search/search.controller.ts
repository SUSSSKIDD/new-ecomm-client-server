import { Controller, Get, Query, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchService } from './search.service';
import {
  SearchProductsDto,
  SearchSuggestionsDto,
} from './dto/search-query.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Search products with full-text search and cursor pagination',
  })
  @ApiResponse({ status: 200, description: 'Paginated product results' })
  @Header('Cache-Control', 'public, max-age=60, stale-while-revalidate=30')
  async searchProducts(@Query() query: SearchProductsDto) {
    return this.searchService.searchProducts(query);
  }

  @Get('suggestions')
  @ApiOperation({ summary: 'Autocomplete suggestions for search typeahead' })
  @ApiResponse({ status: 200, description: 'List of matching product names' })
  @Header('Cache-Control', 'public, max-age=30')
  async getSuggestions(@Query() query: SearchSuggestionsDto) {
    return this.searchService.getSuggestions(query);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get all categories with product counts' })
  @ApiResponse({ status: 200, description: 'List of categories with counts' })
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=60')
  async getCategories() {
    return this.searchService.getCategories();
  }
}
