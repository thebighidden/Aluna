ALTER TABLE "users"
ADD COLUMN "bannedUntil" TIMESTAMP(3),
ADD COLUMN "banReason" TEXT,
ADD COLUMN "requestLimitPerHour" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN "requestLimitPerDay" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "maxVariantsPerRequest" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN "maxConcurrentRequests" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "platform_settings" (
  "id" TEXT NOT NULL DEFAULT 'main',
  "generationProvider" TEXT NOT NULL DEFAULT 'cloudflare',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);
