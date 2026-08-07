-- CreateTable
CREATE TABLE "brand_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "businessType" TEXT NOT NULL DEFAULT 'other',
    "businessSubcategory" TEXT,
    "website" TEXT,
    "description" TEXT,
    "slogan" TEXT,
    "markets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "audience" JSONB NOT NULL DEFAULT '{}',
    "positioning" TEXT,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tone" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryColor" TEXT NOT NULL DEFAULT '#111111',
    "secondaryColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accentColors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "primaryFont" TEXT,
    "secondaryFont" TEXT,
    "photographyStyles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredEnvironments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "forbiddenEnvironments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferredModelAttributes" JSONB NOT NULL DEFAULT '{}',
    "defaultChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultAspectRatios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "defaultCampaignObjectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "forbiddenVisualElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredVisualElements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logoKey" TEXT,
    "logoOriginalName" TEXT,
    "logoMimeType" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_profile_versions" (
    "id" TEXT NOT NULL,
    "brandProfileId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_profile_versions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "generation_runs"
ADD COLUMN "productType" TEXT,
ADD COLUMN "brandProfileVersion" INTEGER,
ADD COLUMN "brandSnapshot" JSONB,
ADD COLUMN "productContext" JSONB,
ADD COLUMN "creativePlan" JSONB,
ADD COLUMN "creativeFingerprint" TEXT,
ADD COLUMN "contextWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "brand_profiles_userId_key" ON "brand_profiles"("userId");
CREATE INDEX "brand_profiles_businessType_idx" ON "brand_profiles"("businessType");
CREATE UNIQUE INDEX "brand_profile_versions_brandProfileId_version_key" ON "brand_profile_versions"("brandProfileId", "version");
CREATE INDEX "brand_profile_versions_brandProfileId_createdAt_idx" ON "brand_profile_versions"("brandProfileId", "createdAt");
CREATE INDEX "generation_runs_creativeFingerprint_idx" ON "generation_runs"("creativeFingerprint");

-- AddForeignKey
ALTER TABLE "brand_profiles" ADD CONSTRAINT "brand_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_profile_versions" ADD CONSTRAINT "brand_profile_versions_brandProfileId_fkey" FOREIGN KEY ("brandProfileId") REFERENCES "brand_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
