-- Extend leads for encrypted contacts + verification metadata
ALTER TABLE "leads" ALTER COLUMN "message" DROP NOT NULL;
ALTER TABLE "leads" ALTER COLUMN "reply" DROP NOT NULL;

ALTER TABLE "leads" ADD COLUMN "contact_encrypted" TEXT;
ALTER TABLE "leads" ADD COLUMN "contact_hash" TEXT;
ALTER TABLE "leads" ADD COLUMN "contact_channel" TEXT;
ALTER TABLE "leads" ADD COLUMN "topic" TEXT;
ALTER TABLE "leads" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE "leads" ADD COLUMN "inquiry_message" TEXT;
ALTER TABLE "leads" ADD COLUMN "building_ref" TEXT;
ALTER TABLE "leads" ADD COLUMN "unit_ref" TEXT;
ALTER TABLE "leads" ADD COLUMN "project_slug" TEXT;
ALTER TABLE "leads" ADD COLUMN "page_url" TEXT;
ALTER TABLE "leads" ADD COLUMN "chat_session_id" TEXT;
ALTER TABLE "leads" ADD COLUMN "consent_at" TIMESTAMP(3);
ALTER TABLE "leads" ADD COLUMN "verified_at" TIMESTAMP(3);

CREATE INDEX "leads_contact_hash_idx" ON "leads"("contact_hash");
CREATE INDEX "leads_status_idx" ON "leads"("status");
CREATE INDEX "leads_verified_at_idx" ON "leads"("verified_at");
