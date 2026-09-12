-- Add per-variant name/description. NULL means inherit from parent Product.
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "ProductVariant" ADD COLUMN IF NOT EXISTS "description" TEXT;
