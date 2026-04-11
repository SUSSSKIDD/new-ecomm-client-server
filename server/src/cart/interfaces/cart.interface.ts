export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string | null;
  taxRate?: number;
  // Print factory custom fields
  selectedSize?: string;
  userUploadUrls?: string[];
  printProductId?: string;
  variantId?: string;
  variantLabel?: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: string;
}
