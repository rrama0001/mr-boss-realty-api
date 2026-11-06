-- Admin-configurable retention for persisted AI chat sessions/messages.

ALTER TABLE "website_settings"
ADD COLUMN "chat_session_retention_days" INTEGER DEFAULT 60;

UPDATE "website_settings"
SET "chat_session_retention_days" = 60
WHERE "chat_session_retention_days" IS NULL;
