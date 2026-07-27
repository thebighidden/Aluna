-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('QUEUED', 'ANALYZING', 'GENERATING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "generation_runs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'user_demo',
    "status" "GenerationStatus" NOT NULL DEFAULT 'QUEUED',
    "category" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "inputKey" TEXT NOT NULL,
    "outputKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "costUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "generation_runs_createdAt_idx" ON "generation_runs"("createdAt");

-- CreateIndex
CREATE INDEX "generation_runs_status_idx" ON "generation_runs"("status");
