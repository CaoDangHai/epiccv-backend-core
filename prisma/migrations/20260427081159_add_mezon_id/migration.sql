/*
  Warnings:

  - A unique constraint covering the columns `[mezonId]` on the table `candidates` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "candidates" ADD COLUMN     "mezonId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "candidates_mezonId_key" ON "candidates"("mezonId");
