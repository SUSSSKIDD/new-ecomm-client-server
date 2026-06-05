-- Add missing indexes for dashboard and store panel queries

-- Order: paymentStatus filter in revenue aggregation
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- Order: standalone createdAt for today's order count in dashboard
CREATE INDEX IF NOT EXISTS "Order_createdAt_idx" ON "Order"("createdAt" DESC);

-- Order: updatedAt for store order list sort
CREATE INDEX IF NOT EXISTS "Order_updatedAt_idx" ON "Order"("updatedAt" DESC);

-- Order: composite status+createdAt for admin order list with status filter + date sort
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt" DESC);

-- PaymentLedger: date for ledger orderBy and date range filter
CREATE INDEX IF NOT EXISTS "PaymentLedger_date_idx" ON "PaymentLedger"("date" DESC);

-- PaymentLedger: createdAt for transaction ID sequence generation
CREATE INDEX IF NOT EXISTS "PaymentLedger_createdAt_idx" ON "PaymentLedger"("createdAt" DESC);

-- PaymentLedger: composite storeId+date for store-specific ledger with date range
CREATE INDEX IF NOT EXISTS "PaymentLedger_storeId_date_idx" ON "PaymentLedger"("storeId", "date" DESC);
