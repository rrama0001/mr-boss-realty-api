-- AlterTable
ALTER TABLE "projects" ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "projects" ADD COLUMN "featured_sort_order" INTEGER;
