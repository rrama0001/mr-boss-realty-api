-- Soft-delete support for inventory entities
ALTER TABLE "projects" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "buildings" ADD COLUMN "deleted_at" TIMESTAMP(3);
ALTER TABLE "units" ADD COLUMN "deleted_at" TIMESTAMP(3);

CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");
CREATE INDEX "buildings_deleted_at_idx" ON "buildings"("deleted_at");
CREATE INDEX "units_deleted_at_idx" ON "units"("deleted_at");
