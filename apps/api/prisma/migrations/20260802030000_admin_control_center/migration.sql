ALTER TABLE "users"
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "loginCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "generation_runs"
ADD COLUMN "ownerName" TEXT,
ADD COLUMN "ownerEmail" TEXT;

UPDATE "generation_runs" AS generation
SET
  "ownerName" = users."name",
  "ownerEmail" = users."email"
FROM "users" AS users
WHERE generation."userId" = users."id";

CREATE TABLE "site_visits" (
  "id" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "visitorId" TEXT NOT NULL,
  "referrer" TEXT,
  "country" TEXT,
  "device" TEXT NOT NULL DEFAULT 'desktop',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "site_visits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "site_visits_createdAt_idx" ON "site_visits"("createdAt");
CREATE INDEX "site_visits_visitorId_createdAt_idx" ON "site_visits"("visitorId", "createdAt");
CREATE INDEX "site_visits_path_createdAt_idx" ON "site_visits"("path", "createdAt");
