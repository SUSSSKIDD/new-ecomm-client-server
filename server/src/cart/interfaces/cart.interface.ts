export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string | null;
  // Print factory custom fields
  selectedSize?: string;
  userUploadUrls?: string[];
  printProductId?: string;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: string;
}
