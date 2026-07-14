-- AlterTable
ALTER TABLE "projects" ADD COLUMN "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "projects_slug_key" ON "projects"("slug");
