export interface ProductListItem {
  id: string;
  name: string;
  price: number;
  mrp: number | null;
  category: string;
  subCategory: string | null;
  stock: number;
  isGrocery: boolean;
  image: string | null;
  relevanceScore?: number;
}

export interface SearchProductsResponse {
  data: ProductListItem[];
  cursor: {
    next: string | null;
  };
  meta: {
    hasMore: boolean;
    total?: number;
    page?: number;
    totalPages?: number;
  };
}

export interface SuggestionItem {
  id: string;
  name: string;
  category: string;
}

export interface SearchSuggestionsResponse {
  suggestions: SuggestionItem[];
}

export interface CategoryItem {
  category: string;
  count: number;
}

export interface CategoriesResponse {
  categories: CategoryItem[];
}
