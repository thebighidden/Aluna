ALTER TABLE "generation_runs"
ADD COLUMN "providerUsageUnits" DECIMAL(12, 2) NOT NULL DEFAULT 0,
ADD COLUMN "providerUsageUnit" TEXT NOT NULL DEFAULT 'tokens';

CREATE INDEX "generation_runs_provider_createdAt_idx"
ON "generation_runs"("provider", "createdAt");
