/*
  Warnings:

  - You are about to drop the `amenities` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "amenities" DROP CONSTRAINT "amenities_project_id_fkey";

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "amenities" TEXT,
ADD COLUMN     "images_videos_link" TEXT,
ADD COLUMN     "showroom_location" TEXT,
ADD COLUMN     "status" TEXT;

-- AlterTable
ALTER TABLE "units" ADD COLUMN     "images_videos_link" TEXT;

-- DropTable
DROP TABLE "amenities";
