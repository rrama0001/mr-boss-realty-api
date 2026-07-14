/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `ai_settings` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `leads` table. All the data in the column will be lost.
  - Added the required column `updated_at` to the `ai_settings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ai_settings" DROP COLUMN "updatedAt",
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "createdAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
