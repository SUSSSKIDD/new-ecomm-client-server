/** Centralised TTL constants (seconds) for all Redis cache keys. */
export const TTL = {
  CART: 48 * 3600,              // 48 hours
  PRODUCT_LIST: 120,            // 2 minutes
  SEARCH_RESULTS: 120,          // 2 minutes
  SUGGESTIONS: 60,              // 1 minute
  CATEGORIES: 300,              // 5 minutes
  STORES: 3600,                 // 1 hour
  ORDER_LIST: 300,              // 5 minutes
  FULFILLMENT: 300,             // 5 minutes
  LOCATION: 300,                // 5 minutes
  RIDER_ONLINE: 300,            // 5 minutes
  ORDER_SNAPSHOT: 600,          // 10 minutes
  ELIGIBLE_RIDERS: 600,         // 10 minutes
  IDEMPOTENCY: 300,             // 5 minutes
  LOCK: 30,                     // 30 seconds
  REJECTED_RIDERS: 3600,        // 1 hour
  OTP_RATE_LIMIT: 900,          // 15 minutes
} as const;
