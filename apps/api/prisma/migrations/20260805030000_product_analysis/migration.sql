CREATE TABLE "product_analyses" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "inputKey" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "productClass" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "confidence" DECIMAL(4,3) NOT NULL DEFAULT 0,
  "attributes" JSONB NOT NULL,
  "scenes" JSONB NOT NULL,
  "model" TEXT NOT NULL,
  "costUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "product_analyses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_analyses_userId_createdAt_idx"
ON "product_analyses"("userId", "createdAt");

ALTER TABLE "product_analyses"
ADD CONSTRAINT "product_analyses_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
