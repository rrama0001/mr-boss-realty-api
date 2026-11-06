-- Admin-configurable outbound mail From name/email (Resend/SMTP).

ALTER TABLE "website_settings" ADD COLUMN "mail_from_name" TEXT;
ALTER TABLE "website_settings" ADD COLUMN "mail_from_email" TEXT;
