-- Per-slide text content for the homepage hero carousel (badge/heading/subheading).
ALTER TABLE "HomepageBanner" ADD COLUMN IF NOT EXISTS "badgeText" TEXT;
ALTER TABLE "HomepageBanner" ADD COLUMN IF NOT EXISTS "heading" TEXT;
ALTER TABLE "HomepageBanner" ADD COLUMN IF NOT EXISTS "subheading" TEXT;
