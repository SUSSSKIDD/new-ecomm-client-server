import { FulfillmentItem } from '../order-fulfillment.service';

export interface PreviewItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  image: string | null;
  inStock: boolean;
}

export interface OrderPreview {
  items: PreviewItem[];
  subtotal: number;
  deliveryFee: number;
  tax: number;
  total: number;
  freeDeliveryEligible: boolean;
}

export interface FulfillmentPreview extends OrderPreview {
  fulfillment: {
    availableItems: FulfillmentItem[];
    unavailableItems: FulfillmentItem[];
    allAvailable: boolean;
  };
}
