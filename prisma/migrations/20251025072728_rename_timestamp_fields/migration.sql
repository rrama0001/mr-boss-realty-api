/*
  Warnings:

  - You are about to drop the column `createdAt` on the `leads` table. All the data in the column will be lost.
  - Made the column `temperature` on table `ai_settings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `max_tokens` on table `ai_settings` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updated_at` to the `leads` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "ai_settings" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "id" SET DEFAULT 1,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "model" DROP DEFAULT,
ALTER COLUMN "prompt" DROP DEFAULT,
ALTER COLUMN "temperature" SET NOT NULL,
ALTER COLUMN "temperature" DROP DEFAULT,
ALTER COLUMN "max_tokens" SET NOT NULL,
ALTER COLUMN "max_tokens" DROP DEFAULT;
DROP SEQUENCE "ai_settings_id_seq";

-- AlterTable
ALTER TABLE "leads" DROP COLUMN "createdAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
