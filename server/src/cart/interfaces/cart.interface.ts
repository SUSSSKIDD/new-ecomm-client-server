export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image: string | null;
}

export interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: string;
}
