-- Add index on Product.storeId — previously missing, causes seq scan on every store-scoped product query
CREATE INDEX IF NOT EXISTS "Product_storeId_idx" ON "Product"("storeId");
CREATE INDEX IF NOT EXISTS "Product_storeId_isActive_idx" ON "Product"("storeId", "isActive");
