-- Preserve existing email signups while accepting WhatsApp numbers for new subscribers.
ALTER TABLE "waitlist_subscribers"
    ALTER COLUMN "email" DROP NOT NULL,
    ADD COLUMN "phone" TEXT;

CREATE UNIQUE INDEX "waitlist_subscribers_phone_key" ON "waitlist_subscribers"("phone");
