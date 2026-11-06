-- Opt-in notification channels: default off until the user enables them.

ALTER TABLE "users" ALTER COLUMN "notify_email" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "notify_sms" SET DEFAULT false;
ALTER TABLE "users" ALTER COLUMN "notify_facebook" SET DEFAULT false;

UPDATE "users"
SET
  "notify_email" = false,
  "notify_sms" = false,
  "notify_facebook" = false;
