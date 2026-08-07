ALTER TABLE "platform_settings"
ADD COLUMN "providerCredentials" JSONB,
ADD COLUMN "credentialMetadata" JSONB;

ALTER TABLE "waitlist_subscribers"
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'new',
ADD COLUMN "notes" TEXT,
ADD COLUMN "contactedAt" TIMESTAMP(3);

CREATE INDEX "waitlist_subscribers_status_createdAt_idx"
ON "waitlist_subscribers"("status", "createdAt");
