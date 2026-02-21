-- Add tsvector column for full-text search
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector;

-- Populate searchVector from existing data (weighted: name=A, category=B, description=C)
UPDATE "Product" SET "searchVector" =
  setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("category", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'C');

-- GIN index for fast full-text lookup
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");

-- Auto-update trigger: keeps searchVector in sync on INSERT/UPDATE
CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."category", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE OF "name", "category", "description"
  ON "Product" FOR EACH ROW
  EXECUTE FUNCTION product_search_vector_update();

-- Partial index for in-stock filtering
CREATE INDEX "Product_stock_partial_idx" ON "Product" ("stock") WHERE "stock" > 0;
