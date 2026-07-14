/*
  Warnings:

  - You are about to drop the column `has_freebies` on the `buildings` table. All the data in the column will be lost.
  - You are about to drop the column `total_units` on the `buildings` table. All the data in the column will be lost.
  - Changed the type of `floor` on the `units` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "buildings" DROP COLUMN "has_freebies",
DROP COLUMN "total_units",
ADD COLUMN     "freebies" TEXT;

-- AlterTable
ALTER TABLE "units" DROP COLUMN "floor",
ADD COLUMN     "floor" INTEGER NOT NULL;

-- ✅ Add the new freebies column to buildings
ALTER TABLE "buildings" ADD COLUMN IF NOT EXISTS "freebies" TEXT;