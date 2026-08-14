/*
  Warnings:

  - You are about to drop the column `groupId` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `paidById` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `ExpenseParticipant` table. All the data in the column will be lost.
  - You are about to drop the column `fromUserId` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the column `settledAt` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the column `toUserId` on the `Settlement` table. All the data in the column will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[expenseId,participantId]` on the table `ExpenseParticipant` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shareToken]` on the table `Settlement` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `billId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paidByParticipantId` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participantId` to the `ExpenseParticipant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `billId` to the `Settlement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromParticipantId` to the `Settlement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shareToken` to the `Settlement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `toParticipantId` to the `Settlement` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_ACCOUNT');

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT "Expense_paidById_fkey";

-- DropForeignKey
ALTER TABLE "ExpenseParticipant" DROP CONSTRAINT "ExpenseParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_createdById_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_fromUserId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Settlement" DROP CONSTRAINT "Settlement_toUserId_fkey";

-- DropIndex
DROP INDEX "Expense_groupId_idx";

-- DropIndex
DROP INDEX "Expense_paidById_idx";

-- DropIndex
DROP INDEX "ExpenseParticipant_expenseId_userId_key";

-- DropIndex
DROP INDEX "ExpenseParticipant_userId_idx";

-- DropIndex
DROP INDEX "Settlement_fromUserId_idx";

-- DropIndex
DROP INDEX "Settlement_groupId_idx";

-- DropIndex
DROP INDEX "Settlement_toUserId_idx";

-- AlterTable
ALTER TABLE "Expense" DROP COLUMN "groupId",
DROP COLUMN "paidById",
ADD COLUMN     "billId" TEXT NOT NULL,
ADD COLUMN     "paidByParticipantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "ExpenseParticipant" DROP COLUMN "userId",
ADD COLUMN     "participantId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Settlement" DROP COLUMN "fromUserId",
DROP COLUMN "groupId",
DROP COLUMN "settledAt",
DROP COLUMN "toUserId",
ADD COLUMN     "billId" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fromParticipantId" TEXT NOT NULL,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "shareToken" TEXT NOT NULL,
ADD COLUMN     "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "toParticipantId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Group";

-- DropTable
DROP TABLE "GroupMember";

-- DropEnum
DROP TYPE "GroupRole";

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillParticipant" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentInfo" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'BANK_ACCOUNT',
    "bankName" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,

    CONSTRAINT "PaymentInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bill_ownerId_idx" ON "Bill"("ownerId");

-- CreateIndex
CREATE INDEX "BillParticipant_billId_idx" ON "BillParticipant"("billId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentInfo_participantId_key" ON "PaymentInfo"("participantId");

-- CreateIndex
CREATE INDEX "Expense_billId_idx" ON "Expense"("billId");

-- CreateIndex
CREATE INDEX "Expense_paidByParticipantId_idx" ON "Expense"("paidByParticipantId");

-- CreateIndex
CREATE INDEX "ExpenseParticipant_participantId_idx" ON "ExpenseParticipant"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseParticipant_expenseId_participantId_key" ON "ExpenseParticipant"("expenseId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_shareToken_key" ON "Settlement"("shareToken");

-- CreateIndex
CREATE INDEX "Settlement_billId_idx" ON "Settlement"("billId");

-- CreateIndex
CREATE INDEX "Settlement_fromParticipantId_idx" ON "Settlement"("fromParticipantId");

-- CreateIndex
CREATE INDEX "Settlement_toParticipantId_idx" ON "Settlement"("toParticipantId");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillParticipant" ADD CONSTRAINT "BillParticipant_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByParticipantId_fkey" FOREIGN KEY ("paidByParticipantId") REFERENCES "BillParticipant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseParticipant" ADD CONSTRAINT "ExpenseParticipant_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "BillParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentInfo" ADD CONSTRAINT "PaymentInfo_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "BillParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;
