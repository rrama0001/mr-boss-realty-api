-- Replace username with full_name; add phone, Facebook PSID, and notify toggles.

ALTER TABLE "users" ADD COLUMN "full_name" TEXT;
UPDATE "users" SET "full_name" = "username" WHERE "full_name" IS NULL;
ALTER TABLE "users" ALTER COLUMN "full_name" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "username";

ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "facebook_psid" TEXT;

ALTER TABLE "users" ADD COLUMN "notify_email" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notify_sms" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "notify_facebook" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'agent';
