CREATE TABLE "campaigns" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "productType" TEXT,
  "category" TEXT NOT NULL,
  "sceneId" TEXT NOT NULL,
  "brief" TEXT,
  "creativeOptions" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "campaigns_userId_updatedAt_idx" ON "campaigns"("userId", "updatedAt");

ALTER TABLE "campaigns"
ADD CONSTRAINT "campaigns_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "generation_runs" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "generation_runs" ADD COLUMN "sharedAt" TIMESTAMP(3);

CREATE INDEX "generation_runs_campaignId_idx" ON "generation_runs"("campaignId");
CREATE INDEX "generation_runs_sharedAt_idx" ON "generation_runs"("sharedAt");

ALTER TABLE "generation_runs"
ADD CONSTRAINT "generation_runs_campaignId_fkey"
FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
