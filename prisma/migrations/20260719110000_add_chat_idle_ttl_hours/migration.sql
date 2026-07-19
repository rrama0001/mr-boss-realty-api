-- Optional idle chat TTL: NULL = disabled (default). Positive = clear website chat UI after N idle hours.
ALTER TABLE "website_settings"
ADD COLUMN "chat_idle_ttl_hours" INTEGER;

ALTER TABLE "website_settings"
ADD CONSTRAINT "website_settings_chat_idle_ttl_hours_check"
CHECK (
  "chat_idle_ttl_hours" IS NULL
  OR ("chat_idle_ttl_hours" BETWEEN 1 AND 720)
);
