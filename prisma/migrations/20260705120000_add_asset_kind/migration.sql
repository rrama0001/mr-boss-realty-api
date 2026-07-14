ALTER TABLE "assets" ADD COLUMN "kind" TEXT;

UPDATE "assets"
SET "kind" = 'logo'
WHERE "unit_id" IS NULL
  AND "image_link" IS NOT NULL
  AND "image_link" LIKE '%/logo.%';

UPDATE "assets"
SET "kind" = 'unit'
WHERE "unit_id" IS NOT NULL
  AND "kind" IS NULL;
