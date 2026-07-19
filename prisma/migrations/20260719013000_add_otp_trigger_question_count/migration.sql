-- Optional OTP trigger: NULL = disabled (default). Positive integer = after N client questions.
ALTER TABLE "website_settings"
ADD COLUMN "otp_trigger_question_count" INTEGER;

ALTER TABLE "website_settings"
ADD CONSTRAINT "website_settings_otp_trigger_question_count_check"
CHECK (
  "otp_trigger_question_count" IS NULL
  OR ("otp_trigger_question_count" BETWEEN 1 AND 100)
);
