-- Add per-variant taxRate. NULL means inherit from parent Product.taxRate.
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION;
