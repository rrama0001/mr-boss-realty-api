-- Admin-only reversible contact storage (hash remains for dedup).
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "contact_encrypted" TEXT;
