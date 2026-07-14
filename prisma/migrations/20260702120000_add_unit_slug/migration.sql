-- AlterTable
ALTER TABLE "units" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "units_slug_key" ON "units"("slug");
