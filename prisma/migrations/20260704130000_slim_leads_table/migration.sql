-- Reset leads and keep only minimal verified-lead fields.
TRUNCATE TABLE "leads" RESTART IDENTITY;

ALTER TABLE "leads" DROP COLUMN IF EXISTS "name";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "message";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "reply";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "contact_encrypted";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "contact_channel";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "topic";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "status";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "project_slug";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "page_url";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "chat_session_id";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "consent_at";
ALTER TABLE "leads" DROP COLUMN IF EXISTS "updated_at";

ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_last4" TEXT;

ALTER TABLE "leads" ALTER COLUMN "contact_hash" SET NOT NULL;
ALTER TABLE "leads" ALTER COLUMN "source" SET DEFAULT 'website';

DROP INDEX IF EXISTS "leads_status_idx";

CREATE INDEX IF NOT EXISTS "leads_building_ref_idx" ON "leads"("building_ref");
