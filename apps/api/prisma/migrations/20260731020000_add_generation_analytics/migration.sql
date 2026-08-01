ALTER TABLE "generation_runs"
ADD COLUMN "model" TEXT NOT NULL DEFAULT 'gpt-image-2',
ADD COLUMN "quality" TEXT NOT NULL DEFAULT 'medium',
ADD COLUMN "imageSize" TEXT NOT NULL DEFAULT '1024x1024',
ADD COLUMN "requestedVariants" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "inputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "inputTextTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "inputImageTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "outputTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "totalTokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "errorCode" TEXT;

UPDATE "generation_runs"
SET "requestedVariants" = GREATEST(COALESCE(array_length("outputKeys", 1), 0), 1);

CREATE INDEX "generation_runs_model_idx" ON "generation_runs"("model");
