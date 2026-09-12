-- Homepage hero carousel: exactly 3 fixed, admin-configurable slots.
CREATE TABLE IF NOT EXISTS "HomepageBanner" (
    "id" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomepageBanner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HomepageBanner_slot_key" ON "HomepageBanner"("slot");
