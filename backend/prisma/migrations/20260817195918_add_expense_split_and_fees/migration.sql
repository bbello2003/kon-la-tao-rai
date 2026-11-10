-- CreateEnum
CREATE TYPE "ExpenseSplitMode" AS ENUM ('EQUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FeeSplitMode" AS ENUM ('EQUAL', 'PROPORTIONAL');

-- AlterTable
ALTER TABLE "Expense"
ADD COLUMN "serviceChargeMode" "FeeSplitMode" NOT NULL DEFAULT 'EQUAL',
ADD COLUMN "serviceChargePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN "splitMode" "ExpenseSplitMode" NOT NULL DEFAULT 'EQUAL',
ADD COLUMN "vatMode" "FeeSplitMode" NOT NULL DEFAULT 'EQUAL',
ADD COLUMN "vatPercent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Add column first as nullable
ALTER TABLE "ExpenseParticipant"
ADD COLUMN "amountSatang" INTEGER;

-- Fill old expenses using equal split
UPDATE "ExpenseParticipant" ep
SET "amountSatang" = (
  SELECT FLOOR(
    e."amountSatang"::numeric /
    (
      SELECT COUNT(*)
      FROM "ExpenseParticipant" ep2
      WHERE ep2."expenseId" = ep."expenseId"
    )
  )::integer
  FROM "Expense" e
  WHERE e."id" = ep."expenseId"
);

-- Make the column required after old rows have been populated
ALTER TABLE "ExpenseParticipant"
ALTER COLUMN "amountSatang" SET NOT NULL;