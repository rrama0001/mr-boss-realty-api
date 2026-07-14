-- AlterTable
ALTER TABLE "buildings" ADD COLUMN "status" TEXT;

-- Copy existing project status onto buildings for backward compatibility
UPDATE "buildings" AS b
SET "status" = p."status"
FROM "projects" AS p
WHERE b."project_id" = p."id"
  AND p."status" IS NOT NULL
  AND p."status" <> ''
  AND (b."status" IS NULL OR b."status" = '');
