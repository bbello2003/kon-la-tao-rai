-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'PROMPTPAY';

-- AlterTable
ALTER TABLE "PaymentInfo" ADD COLUMN     "promptPayId" TEXT,
ALTER COLUMN "method" DROP DEFAULT;
